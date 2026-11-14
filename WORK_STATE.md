# Muse-Chat-MCP 工作狀態

> 最後更新：2026-11-14 20:36（UTC+8）
> 專案目錄：`C:\Users\User\Muse-Chat-MCP`

## Git

| 項目 | 值 |
|---|---|
| Branch | `fix/opencode-tool-calling` |
| 第三輪基準 | `34cd995`（本輪以前） |
| 本輪提交 | `c159a57`（修正＋測試）、`570bb61`（文件）與後續文件提交（含本檔） |
| 追蹤分支 | `fork/fix/opencode-tool-calling`（已同步；實際 HEAD 以 `git log -1` 與 `git ls-remote` 為準） |
| 未提交 | 無（僅刻意不追蹤的 `acceptance-*.mjs`、`muse-login.mjs`） |

## GitHub 同步狀態（2026-11-14 20:36 查詢）

| 項目 | 值 |
|---|---|
| 本機 HEAD ＝ `fork` 遠端分支 ＝ PR #1 head | 一致（實值以 `git log -1`、`git ls-remote` 為準；20:36 查詢時皆為 `75826c2`，20:39 push 後皆為 `9229860`） |
| PR #1 | open、draft、`mergeable: clean`、無審查留言 |
| PR 內容 | 27 commits、21 files、+4265／−104（2026-11-14 20:39 查詢） |
| base `main` | `6c00e8c`（未變動） |
| 尚未對齊 | PR 說明仍是舊文字（寫 10 tests）；需 token 或由使用者貼上，`gh` 未安裝 |

## 最後一個 VERIFIED 任務

**T29（假結果偵測邊界）**，本輪 T27–T29 全部通過 `npm test` 71/71。

證據（2026-11-14 20:xx，Node v24.19.0 / Windows 11）：

- T27：`test/retry-failure.test.mjs` 7 項，修正前全數失敗，修正後全過。
- T28：`thread-routing` 併發恢復測試，修正前 `attempts=3`，修正後 `attempts=2`。
- T29：一般路徑說明、程式碼片段不誤判；宣稱 `/home/hatch` 目錄列表仍攔截。

## 任務狀態

| 任務 | 狀態 | 說明 |
|---|---|---|
| T1 | VERIFIED | 工具呼叫 JSON 修正（`b6e7312`） |
| T2 | VERIFIED | 每對話一個 Side chat（`cb21e89`） |
| T3 | VERIFIED | 併發首請求只建一個 thread |
| T4 | VERIFIED | 散文拒答重試（`044db70`） |
| T5 | VERIFIED | 日誌時間戳／例外記錄 |
| T6 | IN_PROGRESS | Desktop 三步驟已通過（T6a/T6c）；T6b/T6d/T6e/T6g 尚未實機，T6f 平行呼叫待重測 |
| T7 | VERIFIED | `zod@4.6.7`、audit 0、`mcp-schema` 測試通過 |
| T8 | VERIFIED | Side chat 建立失敗改 fail closed |
| T9 | VERIFIED | 以唯一 session id（`x-opencode-session-id`）識別 |
| T10 | VERIFIED | 只接受 `/thread/new`；送出後驗證 uuid |
| T11 | VERIFIED | `tool_choice: required` 契約 |
| T12 | VERIFIED | Windows 路徑控制字元 |
| T13 | VERIFIED | Node 24 完整測試（現 71/71） |
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
| `npm test`（Node v24.19.0 / npm 11.17.0 / Windows 11） | 71/71 pass |
| `node --check muse-openai-shim.mjs` / `muse-driver.mjs` | 0 / 0 |
| `npm ci --dry-run` | exit 0 |
| `npm audit --json` | `vulnerabilities: {}`、exit 0 |
| GitHub Actions（commit `75826c2`，run 43594662737） | 4/4 jobs success（純文件提交仍跑完整矩陣） |
| GitHub Actions（commit `c75ec4e`，run 43594541679） | 4/4 jobs success（純文件提交仍跑完整矩陣） |
| GitHub Actions（commit `570bb61`，run 43594290747） | 4/4 jobs success：node 22/24 × ubuntu/windows |
| GitHub Actions（commit `34cd995`，run 43590192594） | success（4/4 matrix jobs） |
| GitHub Actions（commit `3fdb492`，run 43590078913） | 4/4 jobs success：node 22/24 × ubuntu/windows |
| 路徑解析實測 | naive JSON.parse 得到 char codes 67,58,9,101…（TAB、LF）；shim 得 `C:\temp\new` |
| CLI 兩輪（新 session，上一輪） | `OK` → `FRESH-900`，同一 thread |
| `acceptance-threads.mjs`（上一輪） | 4 項全 true（`E:\Temp\opencode\accept-threads-review.log`） |

本輪已於 2026-11-14T12:20Z push（`34cd995..570bb61`），CI 四組合全過。

## 執行中服務

- shim 由 `E:\Temp\opencode\start-muse-shim.cmd` 啟動（WMI 建立，非 shell 子行程）。
- 日誌：`E:\Temp\opencode\muse-shim.err.log`。
- 目前行程：node PID `33524`（cmd 啟動器 PID `34436`），2026-11-14T12:18:08Z 開始監聽 `127.0.0.1:8787`。
- 前一個行程（PID 34592）在下一次操作前已不存在，8787 無監聽者；日誌無崩潰記錄，原因未確認。本輪修正因此是重新啟動後才生效。
- 啟動後 `/health` → `ok:true`、`browserRunning:false`、`loggedIn:false`；`/v1/models` 回三個 id。尚未有瀏覽器請求，故 `loggedIn:false` 屬預期。
- 20:36 起使用者實際使用（日誌 12:36–12:39Z 共 10 筆 `chat`），`/health` 現在 `browserRunning:true`、`loggedIn:true`、`composerReady:true`，目前頁面是 thread `ad0cb826…`。此後未再重啟。

## 已知風險

1. 舊綁定以內容雜湊為鍵，改用 session id 後不再命中：**既有 OpenCode session 下一次送出會開新對話**，Muse 端先前記憶不延續。
2. 若「新副聊天室」控制失效，請求會直接失敗（fail closed），需改 `MUSE_THREAD_MODE=single` 才能繼續。
3. shim 已兩次無聲結束（原因未確認；最近一次在 2026-11-14 11:24Z 之後、20:17 之前，日誌無錯誤）。目前以 WMI 啟動，長時間穩定性未驗證；結束後 `muse-local` 會直接連線失敗。
4. 隔離提示不是硬邊界。
5. **2026-11-14T12:37–12:39Z 實機使用時發現（未修正）**：兩個不同的 OpenCode session（`session:ses_eb1f5bd3…`、`session:ses_e25efd2c…`）在 `.muse-threads.json` 都指向同一個 Muse thread `ad0cb826…`（另有兩個舊鍵也指向它）。日誌顯示 `ses_e25efd2c` 的第一個請求是 `thread=new`（12:37:35.691），卻在 12:39:12.410 綁到既有 thread。原因未確認；最可能是瀏覽器剛啟動，點「新對話」前後都停在上一次的 thread，而當時 `previousThreadId` 取不到值，使「新 uuid」的檢查通過。尚未寫失敗測試，也未重啟（使用者當時正在使用）。

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
- 已修正（未提交、需重啟才生效）：`collectFiles` 只看本輪、`claimsHostToolResult` 假結果偵測＋一次重試＋502、協議加入宿主平台與沙箱警語、無 code-mode 工具時移除其目錄。`npm test` 59/59（當時）。

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

## 2026-11-14 20:30 第三輪審查

- T27（P1）：`requestToolCalls` 第二次 driver 失敗時回 `reply:''`＋明確 error；不再保留第一次未驗證的回覆。新增 `test/retry-failure.test.mjs` 7 項，修正前全失敗。
- T27a（P1 補強）：外層改為 `if (r.error) throw`，不再以「reply 非空」忽略錯誤；driver 只在**本輪新出現**的錯誤提示才算 error（舊回合殘留的提示已標記忽略），避免同一 thread 一次錯誤之後每輪都 502。新增 `sse-errors` 非串流錯誤案例。
- T28（P2）：`pendingCreates` 改為「等待者失敗後重新取得鎖」的迴圈；三個併發請求在首次建立失敗後只重建一次（attempts 3 → 2），全部落在同一 thread。
- T29（P3）：`/home`、`/Users` 只在回覆同時宣稱目錄列表時才視為假結果；一般路徑說明與程式碼片段不再誤判。虛構檔名（無目錄聲明）無法可靠判斷，已寫入 README 限制。
- 文件：README 移除 `x-session-id` 宣稱、測試數 71；WORK_PLAN／WORK_STATE 的 T6 改為 IN_PROGRESS 並拆成 T6a–T6g；CI 更新為 run 43590192594。
- 2026-11-14T12:20Z：`c159a57`（修正＋測試）、`570bb61`（文件）已 push 到 `fork/fix/opencode-tool-calling`；CI [run 43594290747](https://github.com/chinoyan2002/Muse-Chat-MCP/actions/runs/43594290747) 四組合全過。
- 同日 12:18Z 以 WMI 重新啟動 shim（node PID `33524`），本輪修正已生效。

## 下一個動作

1. 更新 PR #1 說明（測試數 71、4/4 matrix、Desktop 已驗與未驗項目），並由使用者裁決是否 Draft → Ready。
2. 剩餘實機驗收 T31（T6b、T6d、T6e、T6f 平行、T6g）需使用者同意後進行。
