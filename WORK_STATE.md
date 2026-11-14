# Muse-Chat-MCP 工作狀態

> 最後更新：2026-11-14 19:25（UTC+8）
> 專案目錄：`C:\Users\User\Muse-Chat-MCP`

## Git

| 項目 | 值 |
|---|---|
| Branch | `fix/opencode-tool-calling` |
| 程式提交 | `8e1d816`（`fix(shim): key threads by the unique session id and fail closed`） |
| 文件提交 | 本次（`README.md`、`ACCEPTANCE-RUN.md`、`WORK_PLAN.md`、`WORK_STATE.md`）；以 `git log -1` 為準 |
| 追蹤分支 | `fork/fix/opencode-tool-calling`（遠端 HEAD `31134f4`） |
| 未提交 | `muse-openai-shim.mjs`、`test/tool-prose-claims.test.mjs`（新）、`README.md`、`ACCEPTANCE-RUN.md`、`WORK_PLAN.md`、`WORK_STATE.md` |

## 最後一個 VERIFIED 任務

**T26（重啟後重跑 Desktop 三步驟）**。

證據（2026-11-14 19:22，新 session、build agent）：

- A：`ses_e2634a5e…` → `8b1462c1…`；OpenCode session 有 `tool read {"path":"C:/Users/User/Muse-Chat-MCP","limit":5}`，結果為實際專案目錄。
- shim 日誌：11:22:25 `thread=new` → 11:23:02 綁定 → 11:23:02.702 同一 thread 第二次請求（工具結果續傳）→ 11:24:28 第三次（FIX-820）。
- B：`ses_e2633d69…` → `8631afde…`；回 `UNKNOWN`。
- 同批 T22–T25 單元測試 59/59。

## 任務狀態

| 任務 | 狀態 | 說明 |
|---|---|---|
| T1 | VERIFIED | 工具呼叫 JSON 修正（`b6e7312`） |
| T2 | VERIFIED | 每對話一個 Side chat（`cb21e89`） |
| T3 | VERIFIED | 併發首請求只建一個 thread |
| T4 | VERIFIED | 散文拒答重試（`044db70`） |
| T5 | VERIFIED | 日誌時間戳／例外記錄 |
| T6 | PENDING | Desktop GUI 人工驗收＋PR 審查 A–J |
| T7 | VERIFIED | `zod@4.6.7`、audit 0、`mcp-schema` 測試通過 |
| T8 | VERIFIED | Side chat 建立失敗改 fail closed |
| T9 | VERIFIED | 以唯一 session id（`x-opencode-session-id`）識別 |
| T10 | VERIFIED | 只接受 `/thread/new`；送出後驗證 uuid |
| T11 | VERIFIED | `tool_choice: required` 契約 |
| T12 | VERIFIED | Windows 路徑控制字元 |
| T13 | VERIFIED | Node 24 完整測試（現 52/52） |
| T14 | VERIFIED | session id 順序；缺 id 回 400 |
| T15 | VERIFIED | SSE 錯誤處理 |
| T16 | VERIFIED | fail-closed 測試補強 |
| T17 | VERIFIED | 遞迴 JSON Schema 子集合 |
| T18 | VERIFIED | 依賴漏洞與 lockfile |
| T19 | VERIFIED | CI matrix 已改並實跑成功（run 43483204976，四組合全過） |
| T20 | VERIFIED | README 同步 |
| T21 | VERIFIED | 測試埠不穩定已修正（探測＋重綁、回歸測試） |
| T22 | VERIFIED | 歷史附件不再重送（只看本輪） |
| T23 | VERIFIED | 假檔案結果偵測＋重試＋502 |
| T24 | VERIFIED | 協議加入宿主平台與沙箱警語 |
| T25 | VERIFIED | 無 code-mode 工具時移除其目錄 |
| T26 | VERIFIED | 重啟後 Desktop 三步驟通過（read 工具實際執行） |

## 驗證指令與結果

| 指令 | 結果 |
|---|---|
| `npm test`（Node v24.19.0 / npm 11.17.0 / Windows 11） | 59/59 pass |
| `node --check muse-openai-shim.mjs` / `muse-driver.mjs` | 0 / 0 |
| `npm ci --dry-run` | exit 0 |
| `npm audit --json` | `vulnerabilities: {}`、exit 0 |
| GitHub Actions（commit `31134f4`，run 43483204976） | 4/4 jobs success：node 22/24 × ubuntu/windows |
| 路徑解析實測 | naive JSON.parse 得到 char codes 67,58,9,101…（TAB、LF）；shim 得 `C:\temp\new` |
| CLI 兩輪（新 session，上一輪） | `OK` → `FRESH-900`，同一 thread |
| `acceptance-threads.mjs`（上一輪） | 4 項全 true（`E:\Temp\opencode\accept-threads-review.log`） |

尚未執行：Node 22 與 Windows runner 的 CI（要 push 後由 Actions 跑）。

## 執行中服務

- shim 由 `E:\Temp\opencode\start-muse-shim.cmd` 啟動（WMI 建立，非 shell 子行程）。
- 日誌：`E:\Temp\opencode\muse-shim.err.log`。

## 已知風險

1. 舊綁定以內容雜湊為鍵，改用 session id 後不再命中：**既有 OpenCode session 下一次送出會開新對話**，Muse 端先前記憶不延續。
2. 若「新副聊天室」控制失效，請求會直接失敗（fail closed），需改 `MUSE_THREAD_MODE=single` 才能繼續。
3. 先前 shim 曾於約 29 分鐘後無聲結束（原因未確認）；目前以 WMI 啟動，長時間穩定性未驗證。
4. 隔離提示不是硬邊界。

## 2026-11-14 02:14 第二輪審查

- 決策：`zod` 由 3.25 升到 4.6.7。理由：SDK 明示接受 v4、漏洞影響的是 v3 線；以 `test/mcp-schema.test.mjs` 驗證 SDK 契約而非只靠 audit 綠燈。MCP 實機（Desktop）尚未重跑。
- 決策：`package-lock.json` 納入版控，CI 用 `npm ci`；不採用 `npm audit fix`。
- 決策：`x-opencode-session` 是 affinity，不可當唯一 id；只認 `x-opencode-session-id` / `x-muse-session-id`，缺 id 回 400（fail fast，不落回雜湊）。
- 決策：SSE 標頭延後到第一個可送出的位元組；之前的失敗一律 5xx JSON。
- 未驗證：Node 22 與 Windows CI（需 push）。
- 額外發現（已修）：串流路徑原本先 `bindThread(r)` 再檢查錯誤；若 fail-closed 結果帶著舊 thread 的 URL，
  會把舊對話綁到新 session（fail-open）。改為 `threadUnavailable` 一律不綁，並以測試證明（拿掉守衛會失敗）。
- 額外發現（已修）：`npm test` 偶發 `bad port`。原因：本機動態 TCP 埠範圍是 1024–14999
  （`netsh int ipv4 show dynamicport tcp`），`listen(0)` 會落到 fetch 規格封鎖的埠（6566、10080 等），
  undici 在連線前就拒絕。改為啟動後探測 `/v1/models`，失敗就重綁，並加 `test/shim-port.test.mjs` 回歸測試。
- shim 仍在執行，本輪未重啟、未跑實機測試。

## 2026-11-14 02:36 Desktop 驗收（隔離通過、工具未執行）

- A：`session:ses_e2a52b683ffeagb7Q06fyHyw0T` → thread `e3518855-62e8-4440-9bf2-f035458b14a9`。
- B：`session:ses_e29ccccafffeFrcnqwgTNjhoGl` → thread `0c9ed4f1-1c38-4c3f-a0cf-e1e726ec5064`；B 回 `UNKNOWN` → 隔離通過。
- A 第三步回到同一 thread，回 `GUI-715` → 連續性通過。
- 工具失敗：A 第一回合只有一次 shim 請求、沒有工具結果的第二次請求；OpenCode session 該回合只有 `text`，沒有 `tool` 區塊；畫面沒有工具卡。回覆的 `/home/hatch` 是 Muse 自己的沙箱。
- OpenCode 端證據：session `agent: plan`、`location.directory: E:\Temp\opencode`；送給 Muse 的 system 約 38,430 字（含 Plan 提醒與 Code Mode browse 目錄）；`files=2` 來自歷史訊息附件被重送。
- 已修正（未提交、需重啟才生效）：`collectFiles` 只看本輪、`claimsHostToolResult` 假結果偵測＋一次重試＋502、協議加入宿主平台與沙箱警語、無 code-mode 工具時移除其目錄。`npm test` 59/59。

## 2026-11-14 02:00 併用事故與修復

- 事故：修正期間使用者在 `push-to-talk` 專案（session `ses_eb1f5bd3…`）同時使用 Muse；
  我重啟 shim（01:35、01:48、01:51、01:53）中斷了進行中的請求，且該 session 被綁到
  `ad0cb826…`，該 thread 先前由雜湊鍵 `f2e3af6b…` 使用（另一個對話）。
- 證據：`.muse-threads.json` 中 `ad0cb826…` 同時對應兩個鍵；shim 日誌 01:51:59 有
  `error: the message could not be confirmed as sent into a fresh Muse thread`。
- 處置：備份 `.muse-threads.json.bak-20261114-020000` 後刪除
  `f2e3af6b…` 與 `session:ses_eb1f5bd3…`；現況 21 筆、無重複 thread。
- 影響：該 session 下一則訊息會開新對話；舊 thread 仍留在 Muse。
- 後續規則：使用者使用期間不重啟 shim、不跑 live 驗收；單元測試不受影響。

## 使用協調規則（2026-11-14 02:05，使用者選定）

- 使用者會主動告知「正在使用 Muse」。收到後：**不重啟 shim、不跑實機驗收**，只執行 `npm test` 等不碰瀏覽器的工作。
- 需要重啟或實機測試時，先詢問並取得同意；不自行判斷「看起來沒在用」。
- 目前唯一待做的實機項目是 Desktop GUI 驗收（T6），由使用者操作，不需要我重啟服務。

## 下一個動作

1. 使用者裁決是否 commit / push 本輪（T22–T26）修正並更新 PR #1 說明。
2. 若要 push，建議 commit：`fix(shim): ignore foreign sandbox results and stale attachments`＋文件。
3. 可選：以變體實驗隔離「Plan 模式／歷史附件」對工具呼叫的影響（非驗收必要）。
