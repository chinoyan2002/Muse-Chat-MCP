# Muse-Chat-MCP 修正版部署與驗收 — 執行紀錄

- 手冊：`Muse-Chat-MCP 修正版部署與驗收手冊 v1.0`（2026-11-13）
- 執行環境：Windows 11 / Node v24.19.0 / npm 11.17.0 / OpenCode v2.2.7
- 專案：`C:\Users\User\Muse-Chat-MCP`
- 修正來源：`https://github.com/chinoyan2002/Muse-Chat-MCP` 分支 `fix/opencode-tool-calling`
- 正本位置：本檔（隨專案目錄保存）

## 1. 最終狀態

| 項目 | 狀態 | 證據 |
|---|---|---|
| 本機分支 | `fix/opencode-tool-calling`，追蹤 `fork/fix/opencode-tool-calling` | `git branch -vv` |
| 基準提交 | `49c68c3`（遠端分支 HEAD） | `git rev-parse FETCH_HEAD` |
| `main` 是否被動到 | 否，`main` = `origin/main` = `6c00e8c` | `git rev-parse main origin/main` |
| 工作目錄修改 | 2 檔：`muse-openai-shim.mjs`、`test/tool-calling.test.mjs`（本機未提交） | `git diff --stat` |
| `.muse-profile` | 保留 | 路徑存在 |
| `muse-login.mjs` | 保留，未修改（2026-11-12 21:55） | 檔案時間 |
| OpenCode 全域設定 | 未修改（原本已有 `muse-local` provider） | 未備份需求 |
| HTTP Shim | 執行中，PID 29028，`127.0.0.1:8787` | `/v1/models` 回 200 |
| Muse 登入 | `loggedIn:true`、`composerReady:true`、viewerId 有值 | MCP 工具實測 |

## 2. 驗收結果（全部為本機實際執行）

| 驗收項目 | 結果 | 證據 |
|---|---|---|
| Fork 分支取得 | PASS | fetch + switch，`49c68c3` |
| 本機分支更新 | PASS | `git branch -vv` |
| 原有 main 保留 | PASS | `main` 與 `origin/main` 同為 `6c00e8c` |
| Muse Profile 保留 | PASS | 目錄存在、登入仍有效 |
| 本機登入程式保留 | PASS | 檔案存在、時間未變 |
| `npm install` | PASS | exit 0，「up to date, audited 97 packages」 |
| `npm test` | PASS | 12 tests / 12 pass / 0 fail（含新增 2 項） |
| HTTP Shim | PASS | `/v1/models` 回三個 model id |
| OpenCode provider | PASS | `opencode-cli models` 列出 `muse-local/muse-spark-1.3` |
| Muse 登入狀態 | PASS | MCP `muse_status` |
| 測試 A 基本文字 | PASS | 中文回覆正常，exit 0 |
| 測試 B Read | PASS（修正後） | `Read package.json`，答 Node `>=18` |
| 測試 C Glob | PASS（修正後） | `Glob "*.mjs" · 13 matches` |
| 測試 D Shell | PASS | `node --version`、`netstat`、`Get-Process` 皆實際執行 |
| 測試 E 多輪工具 | PASS | read → glob → read → shell(npm test) → 結論 |
| 測試 F 平行工具 | PASS | 真實 Muse 單次回應含 2 個 tool_calls（glob + shell），見 `test-extra.log` |
| SSE 串流 | PASS | 10 項檢查全過（單一 finish_reason、單一 `[DONE]`、參數完整） |
| MCP stdio 工具 | PASS | 11 個工具、`muse_chat` 標記往返一致 |
| 最終端到端 | PASS | 見測試 B–F 與 SSE 紀錄 |

證據檔（UTF-8）：`E:\Temp\opencode\test-*.log`、`acc-*.log`、`tdd-*.log`、`muse-service.err.log`。

## 3. 已修正的阻斷問題

### 3.1 症狀

修正版（`49c68c3`）在 OpenCode 真實環境下，`read` 與 `glob` 的工具呼叫沒有被執行，
Muse 回覆的 `{"tool_calls":...}` 被當成普通文字直接輸出。

### 3.2 根因（兩個，皆為實測）

1. **JSON 無效**：Muse 產生 Windows 路徑時沒有轉義反斜線，
   例如 `{"path":"C:\Users\User\Muse-Chat-MCP"}`，`\U` 不是合法 JSON 轉義 → `JSON.parse` 失敗。
2. **參數名不符 schema**：`read` 必要參數是 `filePath`，Muse 送 `path` → 驗證失敗。
   失敗後 `parseToolCalls` 只回 `null`，沒有任何補救，原始字串就當成答案送回宿主。

### 3.3 修正內容

| 檔案:行 | 修改 |
|---|---|
| `muse-openai-shim.mjs:117` | `parseJsonLenient`：解析失敗時，把字串內未轉義的反斜線補成 `\\` 後重試一次 |
| `muse-openai-shim.mjs:159` | `parseToolCallsDetailed`：回傳 `{ calls, error, attempted }`，可分辨「不是工具呼叫」與「是工具呼叫但不合格」 |
| `muse-openai-shim.mjs:293` | `requestToolCalls`：不合格時帶錯誤原因重問 Muse **一次**，仍不合格才回退成文字 |
| `muse-openai-shim.mjs:80-81` | 提示詞明示「用 schema 的精確屬性名（filePath 不是 path）」與反斜線轉義規則 |
| `test/tool-calling.test.mjs` | 新增 2 個測試：反斜線修復、錯誤參數重試 |

TDD 證據：
- 先寫測試 → `npm test` 失敗 2 項（`actual 'stop' / expected 'tool_calls'`、`null.length`）
- 實作後 → 12/12 通過

修正後以真實 Muse 重跑測試 B、C，兩者都成功執行工具。

## 4. 相依漏洞（已完成來源與影響確認，未升級）

- 套件：`zod@3.25.76`（直接相依，`package.json:47`）
- 公告：GHSA-mrhx-c7xc-m3w5，CWE-770，CVSS 7.5，影響範圍 `<4.6.6`
- 描述：驗證「超大型受限集合」時可能耗盡記憶體
- 實際暴露面：`zod` 只用於 `muse-server.mjs:27` 的 MCP 工具輸入 schema；
  輸入來源是本機 MCP 宿主，不是網際網路；`muse-openai-shim.mjs` 的 HTTP 路徑未使用 zod
- 相容性：`@modelcontextprotocol/sdk@1.32.2` 宣告 `zod: "^3.25 || ^4.0"`，接受 v4
- 修補版本：`zod@4.6.7`，`npm audit` 標記為 semver major

**未升級原因**：手冊明文禁止為了消除警告盲目升級；且升級後需重跑 MCP 工具清單與
shim 全流程驗收。已列為待裁決事項，不影響本次部署。

## 5. 2026-11-14 追加驗收

| 項目 | 結果 | 證據 |
|---|---|---|
| 平行工具呼叫（原始證據） | PASS | 單次回應 `tool_calls` 陣列長度 2：`glob{pattern:*.mjs}`、`shell{command:node --version}`；`finish_reason:"tool_calls"` |
| 全新執行緒（`x-muse-thread: new`） | PASS | 導覽回首頁後仍產生 `read` 呼叫，且參數用 `filePath`（非 `path`） |
| 修正提交 | PASS | `b6e7312`，本機分支 ahead 1 |
| 推上 Fork | PASS | `git ls-remote` 顯示遠端分支 = `b6e7312` |
| OpenCode 版本變動 | 已驗證 | Desktop 自動更新至 **v2.3.0**；`models` 仍列出三個 muse-local 模型 |
| 共用服務（非 standalone） | PASS | 以 Desktop 共用服務執行 `Read package.json` → 答 `>=18`；session 標題「Muse 驗收（Desktop 共用服務）」 |

備註：第一輪回報把測試 F 寫成「同一輪出現 Glob 與 shell」，證據不足；已改為
「單次回應含 2 個 tool_calls」，並以 `acceptance-extra.mjs` 的原始 JSON 補證。

## 6. 瀏覽器工具（browse）

- 已安裝 `browse 0.0.16`（`C:\Users\User\.local\bin\browse.exe`），已配對 Chrome（`chrome-acerwork`）。
- 實測：透過 MCP 在真實 Chrome 開啟 `https://muse.ai/`，回傳 `title: Muse`、composer 1 個、訊息 59 則。
- 已知限制：`execute` 的 `page`／`context` 等變數只能在 `tools.browse.execute` 的 `code` 字串內使用；
  直接寫在 OpenCode Code Mode 頂層會得到 `Unknown identifier 'page'`（第一次操作時我自己踩到）。

## 7. 尚未完成 / 需裁決

1. `zod` 是否升級到 `4.6.7`（需重跑 MCP + shim 驗收）。
2. OpenCode **Desktop GUI** 由人工點選的驗收（本次以 Desktop 內附 CLI、含共用服務完成，
   GUI 畫面未由人工點擊）。
3. `muse_status` 在瀏覽器未啟動時回報 `loggedIn:false`（`muse-driver.mjs:195-200`），
   與 README 流程不一致；本次未修改。

## 8. 對話記憶隔離（2026-11-14）

**問題**：Muse 把所有任務放在同一個主對話，且跨對話仍會記得先前內容。

**實測證據**：

| 實驗 | 結果 |
|---|---|
| 兩個不同 Side chat（`bfd0f46c…` 與 `fdbf5407…`），B 詢問 A 教的代號 | B 答出 A 的代號 → 跨對話記憶存在 |
| 切回 A 的 thread（`babe8d0e…`）再問 B 教的代號 | A 仍答出 → 不是「建立當下的快照」，而是持續共享 |
| 同樣流程加上隔離提示 | A 回 `UNKNOWN` → 提示有效 |

**修正內容**：

| 檔案 | 變更 |
|---|---|
| `muse-thread-map.mjs`（新） | 以 system ＋ 第一則使用者訊息推導鍵；JSON 持久化；毀損檔自動備份 |
| `muse-openai-shim.mjs` | `MUSE_THREAD_MODE=session\|single\|new`（預設 session）；自動建立／切換 Side chat；每個 session 請求加入中英隔離提示 |
| `muse-driver.mjs` | 改用 `[data-testid="hatch-chat-compose"]`（原本用英文按鈕名，中文介面會失效）；等待 `/thread/<uuid>`；新聊天室先等 1.2 秒再輸入，避免空回覆 |
| `.gitignore` | 排除 `.muse-threads.json` |
| `README.md` | 補 thread 模式、環境變數與「Muse 跨對話記憶」限制 |
| `test/thread-map.test.mjs`、`test/thread-routing.test.mjs` | 新增 12 項測試 |

**驗收**：

- `npm test`：24/24 通過。
- `acceptance-threads.mjs`（真實 Muse）：A 記得代號、B 回 `UNKNOWN`、兩者 thread 不同、A 續問落在同一 thread。
- 重啟 shim 後 `acceptance-threads-persist.mjs`：同一 thread、仍記得代號。
- OpenCode CLI：`X2` 教代號 → `--continue` 答出代號；全新 session 回 `UNKNOWN`。

**提交**：`cb21e89 feat(shim): one Muse thread per conversation`，已推上 `fork/fix/opencode-tool-calling`。

## 9. 工具呼叫被散文拒答（2026-11-14）

**現象**：在 OpenCode 對話中要求讀取工作目錄，Muse 回覆
「現象：無法讀取本地工作目錄…No such file or directory」，整段對話沒有任何工具呼叫；
使用者端看起來像「Muse 一直在處理、卻沒有實際讀取」。

**重現**（工作目錄 `C:\Users\User\Documents\Default Project\push-to-talk`）：

```
opencode-cli run --model muse-local/muse-spark-1.3 --auto "請讀取目前工作目錄，列出前 10 個檔案。只回報工具結果，不要自行推測。"
```

修正前：回覆同上，shim 日誌只有一次 `chat ... tools=true`，沒有重試記錄。

**根因**：`parseToolCallsDetailed` 只在「看起來像工具呼叫但格式錯誤」時重試；
模型若直接以散文拒答，`attempted` 為 false，shim 視為正常回答直接回傳。

**修正**：

- `muse-openai-shim.mjs`：新增 `looksLikeAccessRefusal()`；在「沒有工具呼叫 + 本輪尚無工具結果」時
  重試一次，明確告知工具由 host 執行、不得聲稱無法存取檔案（仍是一次為限）。
- 併發首請求以 `pendingCreates` 鎖住，避免同一對話建立兩個 Side chat 並覆寫綁定。
- 日誌加 ISO 時間戳；`muse-server.mjs` 加 `uncaughtException` / `unhandledRejection` 記錄。

**驗證**：

- `npm test`：28/28 通過。
- 同一重現指令修正後：`→ Skill "台灣用語"`、`→ Read .`，回覆列出 10 個項目。
- shim 日誌出現 `retrying prose refusal: ...`。
- `acceptance-threads.mjs`：4 項全 true（A 記得、B 回 UNKNOWN、thread 不同、續問同 thread）。

**提交**：`044db70`，已推上 `fork/fix/opencode-tool-calling`。

## 10. 程式碼審查修正（2026-11-14）

審查結論：Session 隔離存在 Fail-open（失敗時退回共用對話）。逐項處理如下。

| 項目 | 根因 | 修正 |
|---|---|---|
| 1. Side chat 建立失敗仍共用對話 | `_newChat()` 失敗後 `_run()` 仍繼續送出；shim 取得不到 uuid 時只記 log | 驅動層改為 fail closed：建立失敗直接回傳錯誤、不送出；shim 不再退回「目前對話」 |
| 2. Session 識別方式 | 原本以 system＋第一則使用者訊息雜湊，system 變動或同文開場會撞號 | 改用 OpenCode 實際送出的 `x-opencode-session`（實測存在），無此標頭才退回雜湊 |
| 3. Thread ID 等待與綁定 | 點擊後接受任何 `/thread/<uuid>`，可能停在原對話；等 12 秒後仍可能沒 uuid | 只接受 `/thread/new` 出現過才繼續；等待延長至 20 秒；送出後再驗證 uuid 與送出前不同，否則視為失敗 |
| 4. `tool_choice: required` | 模型回散文時仍以 `finish_reason: stop` 結束 | 重試一次要求工具呼叫；仍無則回 502，不假裝完成 |
| 5. Windows 路徑 JSON | `C:\temp\new` 是合法 JSON，`\t`、`\n` 會變成控制字元 | 偵測「磁碟機開頭且含控制字元」的字串，改用反斜線保留版本重解析 |
| 6. 測試 | 缺平行工具、Session 隔離、fail-closed 案例 | 新增 9 項（28 → 37） |
| 7. Node 24 完整測試 | 先前僅記錄 CI 的 Node 22 | 本機 `v24.19.0`／npm 11.17.0 執行 `npm test`：37/37 |
| 8. 實機與 Desktop 驗收 | 尚未完成 | CLI 實測完成（見下）；Desktop GUI 仍需人工點擊 |

**另外修正**：OpenCode 的「產生標題」請求原本會各自建立 Side chat，現在固定使用 `opencode:titles` 這一個專用對話，不會污染各 session 的對話。

**實機證據**：

- 新 session 兩輪：`session:ses_e29f4d3f…` → thread `69390962…`；第二輪回 `FRESH-900`。
- 標題請求 → `opencode:titles` → thread `f202aec7…`，未建立新對話。
- shim 日誌無 `error:`、無重試。

**注意（一次性影響）**：舊的綁定是以內容雜湊為鍵，改為 session id 後不再命中；既有的 OpenCode session 下一次送出會開新對話，Muse 端先前的記憶不再延續。

## 11. 第二輪程式碼審查（2026-11-14，PR #1 第 1–8 項）

基準：PR HEAD `11a3dde`、base `6c00e8c`。本輪修正已提交（程式 `8e1d816`，文件另成一筆）。

> 修正：§10 第 2 項寫「改用 `x-opencode-session`」是錯的。OpenCode 的
> `x-opencode-session` 是 **affinity**（子工作階段沿用父 id、fork 沿用來源 id），
> 唯一 id 是 `x-opencode-session-id`。本節已改掉，以本節為準。

### 11.1 逐項處理

| 審查項 | 修正內容 | 位置 | 驗證 |
|---|---|---|---|
| 1 P1 Session ID 順序 | 只接受 `x-opencode-session-id` 或 `x-muse-session-id`；不再讀 affinity（`x-opencode-session`、`x-session-id`）；沒有唯一 id 時回 400 `missing_session_id`，不再退回 prompt 雜湊；舊雜湊需 `MUSE_THREAD_KEY=hash` 才啟用；`opencode:titles` 維持獨立 | `muse-openai-shim.mjs:76-88`、`:572-620` | `thread-routing` A–G 共 7 項 |
| 2 P1 SSE 錯誤 | SSE 標頭延後到第一個可送出的位元組；在那之前的失敗（建 thread、driver、tool_choice）回真正的 5xx JSON；已開始串流後失敗則送 `data: {"error":…}` + `[DONE]`，正常結束 | `muse-openai-shim.mjs:648-719`、`:741-758` | `sse-errors` 6 項（含正常串流仍只有一個 `finish_reason` 與 `[DONE]`） |
| 3 P1 fail-closed 測試 | stub 改成 driver 真實錯誤契約（`reply:''`、`error`、`threadUnavailable:true`），實際發 HTTP，驗 502、錯誤訊息、Map 無新增、下一次仍要求新 thread。另補：串流路徑即使 fail-closed 結果帶著舊 thread URL，也不得綁定 | `test/thread-routing.test.mjs`、`muse-openai-shim.mjs:627-640` | 原本 2 項＋新增 1 項（把守衛拿掉會失敗，已實測） |
| 3 附帶：`_newChat()` 成功判定 | 只有看過 `/thread/new` 且 composer ready 才回 `ok:true`；送出後再比對 uuid 與送出前不同，否則回 `threadUnavailable` | `muse-driver.mjs:244-263`、`:518-535` | 程式碼核對；失敗路徑由上述測試覆蓋 |
| 4 P2 Schema 驗證 | 遞迴驗證：`type`（含 union）、`enum`、`required`、`properties`、`additionalProperties`、`items`、`minItems/maxItems`、`minLength/maxLength`、`minimum/maximum`；未知關鍵字放行；`tool_choice` 無 tools → 400 `missing_tools` | `muse-openai-shim.mjs:160-233`、`:525-537` | `tool-calling` +2 項 |
| 5 P2 依賴 | `zod` 升到 `^4.6.7`（SDK 宣告接受 `^3.25 \|\| ^4.0`）；commit `package-lock.json`、CI 改 `npm ci`；`npm audit` 由 1 high → 0 | `package.json`、`package-lock.json`、`.gitignore`、workflow | `mcp-schema` 1 項＋`npm audit --json` |
| 6 P2 CI 環境 | matrix：`ubuntu-latest` / `windows-latest` × Node 22 / 24；`actions/checkout@v7`、`actions/setup-node@v7`（取自官方 `releases/latest`：v7.0.1、v7.1.0） | `.github/workflows/tool-calling-tests.yml` | run `43483204976`：4/4 success |
| 7 P2 實機驗收 | 清單見 11.3 | 本檔 | 人工，待做 |
| 8 P3 文件 | README 更新 session id / affinity、缺 id 行為、SSE 錯誤、schema 子集合、測試數、CI 環境、E2E 狀態 | `README.md` | 人工核對 |
| 額外：測試不穩定 | 本機動態 TCP 範圍是 1024–14999，`listen(0)` 偶爾拿到 fetch 規格封鎖的埠（如 6566、10080），undici 直接回 `bad port`，造成偶發失敗 | `test-helpers/shim-server.mjs`、`test/shim-port.test.mjs` | 最終版連續 10 次 `npm test` 全過；新增 1 項回歸測試 |

### 11.2 本機驗證證據

| 指令 | 結果 |
|---|---|
| `npm test`（Node v24.19.0 / npm 11.17.0 / Windows 11） | 52 tests / 52 pass / 0 fail（當時；最新為 73/73） |
| `node --check muse-openai-shim.mjs`、`muse-driver.mjs` | 0 / 0 |
| `npm ci --dry-run` | exit 0（lockfile 完整可重現） |
| `npm audit --json` | `vulnerabilities: {}`、exit 0 |
| `git diff --check` | 無空白錯誤 |
| GitHub Actions（commit `31134f4`，run [43483204976](https://github.com/chinoyan2002/Muse-Chat-MCP/actions/runs/43483204976)） | 4/4 jobs success：node 22/24 × ubuntu/windows |

**`npm audit` 紀錄（JSON）**：

- 修正前：`zod@3.25.76`，1 high，GHSA-mrhx-c7xc-m3w5「Zod can exhaust memory while validating oversized constrained collections」，CWE-770，CVSS 7.5，範圍 `<4.6.6`，依賴路徑 `node_modules/zod`，`fixAvailable: zod@4.6.7 (isSemVerMajor)`。
- 修正後：`zod@4.6.7`，`vulnerabilities: {}`，exit 0；`@modelcontextprotocol/sdk@1.32.2` 宣告接受 `zod: "^3.25 || ^4.0"`，並以 `test/mcp-schema.test.mjs` 驗證 SDK 仍能註冊工具、列出 JSON Schema 並呼叫。
- 原始輸出：`E:\Temp\opencode\audit.json`（修正前）、`E:\Temp\opencode\audit-after-zod4.json`（修正後）。

CI 現況：run [43590192594](https://github.com/chinoyan2002/Muse-Chat-MCP/actions/runs/43590192594)（`34cd995`）success；本輪修正尚未 push，CI 待 push 後執行。

### 11.3 人工驗收清單（審查第 7 項 A–J）

實機項目由使用者操作；我這邊不重啟 shim、不跑 live 測試。

| 代號 | 動作 | 現況 |
|---|---|---|
| A | 沿用既有已登入 Chrome Profile，不重新登入 | 已符合：`.muse-profile` 保留、`loggedIn:true`（§1） |
| B | OpenCode 建 Session A、B，第一則 Prompt 完全相同 | 待做 |
| C | 確認 Muse 端出現兩個不同 Side chat | 待做 |
| D | Session A 連問兩次，仍回 A 的 thread | 自動測試 A 通過；實機待做 |
| E | Session B 連問兩次，仍回 B 的 thread | 待做 |
| F | 用 Subagent / child session，不因 parent affinity 共用 thread | 自動測試 C 通過；實機待做 |
| G | 模擬 Side chat 建立失敗，確認不送進 Main 或舊 thread | 自動測試回 502 且不綁定；實機待做 |
| H | 非串流、SSE、單一 Tool Call、平行 Tool Call、Tool Result 續傳 | 2026-11-13 已驗（§2）；本輪 shim 有改動，需重跑 |
| I | Muse 回一般文字但 `tool_choice: required` | 自動測試：重試 1 次後 502；實機待做 |
| J | 隔離提示只是額外防護，不宣稱完全阻擋跨對話記憶 | README 已如實載明；驗收回覆不得宣稱硬隔離 |

**Desktop GUI 三步驟**（使用者操作；每一步請記下 session 標題與時間）：

1. 新 session A：`記住代號 GUI-715。然後讀取目前工作目錄，列出前 5 個檔案。`
   → 應出現 `read`/`glob`/`shell` 工具呼叫並回傳實際檔案。
2. 另開 session B（第一則訊息刻意與 A 不同）：`上一個對話教你的代號是什麼？只回代號或 UNKNOWN。`
   → 應回 `UNKNOWN`（或明確不知道），不得說出 `GUI-715`。
3. 回 session A：`我剛才請你記住的代號是什麼？`
   → 應回 `GUI-715`，且 Muse 端仍是步驟 1 的同一個 thread。

### 11.4 尚未完成 / 需裁決

1. 人工驗收 A–J 僅完成部分（Desktop 三步驟）；進度見 §13.3。
2. 本輪修正已 commit（程式 `8e1d816`；文件提交見 `git log`）並推上 `fork/fix/opencode-tool-calling`。
3. PR #1 說明尚未更新（需使用者同意張貼）。

## 12. Desktop GUI 實測與「假成功」修正（2026-11-14 02:36）

### 12.1 實測結果

使用者在 OpenCode Desktop（`muse-local/muse-spark-1.3`）以既有 session 操作，結果：

| 項目 | 結果 | 證據 |
|---|---|---|
| A/B 是否不同 thread | **PASS** | `session:ses_e2a52b683ffeagb7Q06fyHyw0T` → `e3518855-…`；`session:ses_e29ccccafffeFrcnqwgTNjhoGl` → `0c9ed4f1-…` |
| B 是否記得 A 的代號 | **PASS（回 UNKNOWN）** | 使用者實際回報 |
| A 是否延續 | **PASS（回 GUI-715）** | 第三次請求走同一 thread `e3518855-…` |
| 工具是否由主機執行 | **FAIL** | 畫面沒有工具卡；OpenCode session 紀錄該回合只有 `text`、沒有 `tool` 區塊；shim 日誌該回合只有一次請求（沒有工具結果的第二次請求） |

A 的回覆是「目前工作目錄 /home/hatch，前 5 個檔案：AGENTS.md…」——那是 **Muse 自己的沙箱**，不是主機的 `E:\Temp\opencode`。

### 12.2 從 OpenCode 端取得的證據

以本機 API（`http://127.0.0.1:28894`，Basic auth，密碼取自 `%USERPROFILE%\.local\state\opencode\service.json`）讀取 Session A：

- session：`agent: plan`、`model: muse-local/muse-spark-1.3`、`location.directory: E:\Temp\opencode`
- 該回合 assistant：`content: [{type:"text"}]`、`finish: "stop"`，沒有工具呼叫
- 送給 Muse 的 system 內容約 38,430 字，包含 Plan 模式提醒與 Code Mode 的 browse 工具目錄
- shim 日誌顯示該請求 `files=2`：`collectFiles` 會掃描**全部歷史訊息**，把舊訊息裡的附件重送（獨立缺陷）

### 12.3 已修正（單元測試通過，實機待驗）

| 項目 | 修正 | 測試 |
|---|---|---|
| 歷史附件重送 | `collectFiles` 只看 `body.files` 與**最後一則 user** 訊息 | `tool-prose-claims.test.mjs` |
| 假檔案結果 | 新增 `claimsHostToolResult()`：回覆聲稱的工作目錄與 system prompt 的 `Working directory` 不符、或 Windows 主機出現 `/home/*`、`/Users/*` 時視為假結果；重試一次，仍假則 502 | 同上（重試成功、重複假答 502、正常散文不重試） |
| 協議文字 | 加入 `Host platform` 與「你的沙箱不是主機、不得宣稱未經工具取得的結果」 | 同上 |
| 提示過長 | 當工具清單沒有 code-mode 工具（browse/execute）時，移除 Code Mode 目錄 system 訊息 | 同上 |

`npm test`：59 tests / 59 pass / 0 fail（當時；最新 73/73）。

### 12.4 重跑結果（2026-11-14 19:22，新程式已載入）

新開 session、預設 build agent、模型 `muse-local/muse-spark-1.3`、工作目錄 `C:\Users\User\Muse-Chat-MCP`：

| 項目 | 結果 | 證據 |
|---|---|---|
| A 是否真的執行工具 | **PASS** | OpenCode session `ses_e2634a5e…` 有 `tool` 區塊：`read {"path":"C:/Users/User/Muse-Chat-MCP","limit":5}`，結果 `.git\`、`.github\`、`.muse-profile\`、`docs\`、`examples\` |
| A 是否只有一次請求 | **PASS（有工具續傳）** | shim 日誌 11:22:25 `thread=new` → 11:23:02 綁定 → 11:23:02.702 同一 thread 再送一次（工具結果續傳） |
| A/B 是否不同 thread | **PASS** | A `ses_e2634a5e…` → `8b1462c1…`；B `ses_e2633d69…` → `8631afde…` |
| B 是否記得 A 的代號 | **PASS（UNKNOWN）** | 使用者實測 |
| A 是否延續 | **PASS（FIX-820）** | 第三次請求走同一 thread `8b1462c1…` |

備註：這次第一次嘗試就回工具呼叫，**沒有觸發**新的假結果重試；送出的提示量是 47,838 字，比上次失敗的 38,430 還大。因此上次失敗較可能與「舊 session／Plan 模式／歷史附件」有關，而不是單純提示長度。T22–T25 仍保留為防禦性修正（單元測試覆盖），但不可宣稱它們是這次通過的原因。

CI：commit `3fdb492` 的 [run 43590078913](https://github.com/chinoyan2002/Muse-Chat-MCP/actions/runs/43590078913) 四組合全過（node 22/24 × ubuntu/windows）。

### 12.5 尚未完成

- 上述修正已套用到執行中的 shim（PID 34592），Desktop 三步驟已在新 session 通過（12.4）。
- 舊 session／Plan 模式的失敗原因只到「相關性」層級，尚未以變體實驗證明因果。

## 13. 第三輪審查修正（2026-11-14 20:30）

基準 `34cd995`。

### 13.1 修正內容

| 項目 | 修正 | 測試 |
|---|---|---|
| P1 重試失敗被當成功 | `requestToolCalls` 第二次 driver 失敗時回 `reply:''` 與明確 error；`requiresTool` 時訊息明示需要 tool call。外層不再以「reply 非空」忽略 error；只在 driver 回報**本輪**錯誤時才走 5xx，舊回合殘留的錯誤提示不會誤殺新回覆 | `test/retry-failure.test.mjs` A–F＋鎖釋放，共 7 項；`sse-errors` 新增非串流錯誤案例 |
| P2 Thread 建立失敗的併發恢復 | 等待者醒來若無綁定會**重新取得鎖**；同一 session 永遠只有一個建立者 | `thread-routing` 三併發案例：修正前 `attempts=3`、修正後 `2` |
| P3 假結果偵測邊界 | `/home`、`/Users` 僅在回覆同時宣稱目錄列表時才判定；一般說明與程式碼片段不誤判 | `tool-prose-claims` 新增 3 項（一般路徑、宣稱列表、虛構檔名） |
| P4 文件一致性 | README 移除 `x-session-id`、測試數改 73、新增偵測限制；WORK_PLAN／WORK_STATE 的 T6 拆成 T6a–T6g；CI 更新 | `git diff` 核對 |

### 13.2 證據

- `npm test`：73 tests / 73 pass / 0 fail（Node v24.19.0、Windows 11）。
- TDD：T27 的 7 項在修正前全數失敗；T28 修正前 `attempts=3`；T29 的邊界案例在放寬前會誤判。
- CI：commit `570bb61` 的 [run 43594290747](https://github.com/chinoyan2002/Muse-Chat-MCP/actions/runs/43594290747)、`c75ec4e` 的 [run 43594541679](https://github.com/chinoyan2002/Muse-Chat-MCP/actions/runs/43594541679)、`75826c2` 的 [run 43594662737](https://github.com/chinoyan2002/Muse-Chat-MCP/actions/runs/43594662737) 四組合（node 22/24 × ubuntu/windows）全過。
- `git diff --check`：乾淨。

### 13.3 剩餘實機驗收（尚未完成，不得標記 VERIFIED）

| 項目 | 狀態 |
|---|---|
| A. A/B 使用完全相同第一句仍開兩個 thread | 待做 |
| B. 同 session 後續訊息回原 thread | 已於 §12.4 通過（A 第三步） |
| C. Child Session / Subagent 獨立 thread | 待做（自動測試 C 已覆蓋） |
| D. Side chat 建立失敗時 Desktop 顯示錯誤 | 待做（自動測試已覆蓋 502） |
| E. 平行 Tool Call、Tool Result Continuation | Continuation 已於 §12.4 通過；平行呼叫待重測 |
| F. 拒答／假結果重試失敗不得當成功 | 自動測試已覆蓋；實機待做 |

### 13.4 實機使用中的新發現（2026-11-14T12:37–12:39Z，已修並已載入）

使用者只開了一個對話，OpenCode 自行建立子代理（`ses_e25efd2c…`）；該子代理的 `thread=new` 請求在 12:39:12.410Z 綁到父對話的 thread `ad0cb826…`。這與「一個 session 一個 thread」不符。
修正：`muse-openai-shim.mjs:725-741` 在寫入 map 前檢查該 thread 是否已屬於其他 key，若是則回 502 且不綁定；`muse-driver.mjs:236-240` 先等路由穩定再記錄「點擊前的 thread」。
測試：`thread-routing` 新增「子 session 取得父 thread → 502、map 不新增」，`thread-map` 新增 `keysFor`；兩者在修正前皆失敗。§12.4 的 A/B 兩個不同 thread 結論不受影響。

後續（2026-11-14 21:01–21:02）：

- 修正已 push 到 fork（`d4c6952`）。
- 21:01 重啟 shim 載入新程式（PID 23364），21:02 為清 map 再次重啟（PID 33092）。
- 21:02 備份 `.muse-threads.json.bak-20261114-210224`，刪除子代理與 legacy 雜湊鍵的綁定；現 26 筆，沒有已知的共用 thread。

## 14. 第四輪追加修正（2026-11-14 21:20）

基準 `5577187`。

### 14.1 修正內容

| 項目 | 修正 | 測試 |
|---|---|---|
| P1 第二次重試帶 error | `requestToolCalls` 的第二次 driver 回傳只要含 `error`，一律回 `reply:''` 與明確 error；partial 文字與 tool call 都不採用，也不再檢查 reply 是否為空 | `retry-failure` G–K |
| P1 Thread Map 與鎖 | 失敗在 `bindThread` 之前就拋出，map 不新增也不覆蓋；`pendingCreates` 於 catch 釋放，下一請求可正常建立 | `retry-failure` B（改為斷言未綁定）與鎖釋放案例 |
| P2 第二次仍無效的 tool call | `parseToolCallsDetailed` 回 `attempted` 但沒有 calls 時回 502，不再把原始 JSON 當一般文字 | `retry-failure` L–N |
| P2 契約邊界 | auto 模式下第二次是純散文（未嘗試 tool call）仍可接受；`required` 必須有有效 tool call | `retry-failure` O、C、J；`tool-calling` 未知名稱改為預期 502 |

### 14.2 證據

- `npm test`：83 tests / 83 pass / 0 fail（Node v24.19.0、Windows 11）。
- 修正前：G–N 共 8 項失敗；`tool-calling` 的未知名稱案例因契約變更同步改寫為 502。
- `git diff --check`：乾淨。

### 14.3 尚未完成

- 實機驗收 A–F 不變，仍為 PENDING，不得標記 VERIFIED。
- CI：[run 43599849264](https://github.com/chinoyan2002/Muse-Chat-MCP/actions/runs/43599849264)（`7f8e3be`）四組合全過。
