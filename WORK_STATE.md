# Muse-Chat-MCP 工作狀態

> 最後更新：2026-11-14 21:20（UTC+8）
> 專案目錄：`C:\Users\User\Muse-Chat-MCP`

## Git

| 項目 | 值 |
|---|---|
| Branch | `fix/opencode-tool-calling` |
| 第三輪基準 | `34cd995`（本輪以前） |
| 本輪提交 | `c159a57`（修正＋測試）、`570bb61`（文件）與後續文件提交（含本檔） |
| 追蹤分支 | `fork/fix/opencode-tool-calling`（已同步；實際 HEAD 以 `git log -1` 與 `git ls-remote` 為準） |
| 未提交 | 第四輪修改：`muse-openai-shim.mjs`、`test/retry-failure.test.mjs`、`test/tool-calling.test.mjs`、`README.md`、`ACCEPTANCE-RUN.md`、`WORK_PLAN.md`、`WORK_STATE.md` |

## GitHub 同步狀態（2026-11-14 20:36 查詢）

| 項目 | 值 |
|---|---|
| 本機 HEAD ＝ `fork` 遠端分支 ＝ PR #1 head | 一致（實值以 `git log -1`、`git ls-remote` 為準） |
| PR #1 | open、**ready for review（非 draft）**、`mergeable: clean`、無審查留言 |
| PR 內容 | 32 commits、21 files（2026-11-14 21:10 查詢；之後的修正會再增加） |
| base `main` | `6c00e8c`（未變動） |
| 說明已對齊 | PR 本文已改為 73 tests、run 43597353526、Desktop 已驗與未驗清單（2026-11-14 21:05） |

## 最後一個 VERIFIED 任務

**T34（第二次仍無效的 tool call 不再當文字）**，`npm test` 83/83。

證據（2026-11-14 21:20，Node v24.19.0 / Windows 11）：

- 第四輪新增 9 項測試（`retry-failure` G–O）；修正前 G–N 共 8 項失敗，O 為既有行為。
- `tool-calling` 的「未知工具名稱」改為預期 502（契約變更，依審查要求）。
- 第三輪的 T27–T29、T32 仍全過。

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
| T13 | VERIFIED | Node 24 完整測試（現 73/73） |
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
| T32 | VERIFIED | 新對話若被導回別人的 thread → 502、不綁定（21:01 已重啟載入；21:02 已清舊綁定） |
| T33 | VERIFIED | 第二次重試帶 error 一律失敗；partial reply／tool call 都不回傳 |
| T34 | VERIFIED | 第二次仍無效的 tool call 不再當一般文字；auto 的純散文仍可接受 |

## 驗證指令與結果

| 指令 | 結果 |
|---|---|
| `npm test`（Node v24.19.0 / npm 11.17.0 / Windows 11） | 83/83 pass |
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
- 目前行程：node PID `33092`（cmd 啟動器 PID `34288`），2026-11-14 21:02:37（本機）開始監聽 `127.0.0.1:8787`。這是清 map 後重啟的行程，載入 T32 修正。
- 前一個行程 PID `33524` 於 21:01 由使用者授權後手動停止；停止前 `/health` 為 `browserRunning:true`、`loggedIn:true`，頁面停在 `ad0cb826…`。
- 重啟後 `/health` → `ok:true`、`browserRunning:false`、`loggedIn:false`；`/v1/models` 回三個 id。第一則請求才會重新啟動瀏覽器（`.muse-profile` 會保留登入）。
- 另一個更早的行程（PID 34592）在下一次操作前已不存在；日誌無崩潰記錄，原因未確認。

## 已知風險

1. 舊綁定以內容雜湊為鍵，改用 session id 後不再命中：**既有 OpenCode session 下一次送出會開新對話**，Muse 端先前記憶不延續。
2. 若「新副聊天室」控制失效，請求會直接失敗（fail closed），需改 `MUSE_THREAD_MODE=single` 才能繼續。
3. shim 已兩次無聲結束（原因未確認；最近一次在 2026-11-14 11:24Z 之後、20:17 之前，日誌無錯誤）。目前以 WMI 啟動，長時間穩定性未驗證；結束後 `muse-local` 會直接連線失敗。
4. 隔離提示不是硬邊界。
5. **2026-11-14T12:37–12:39Z 實機使用時發現（已修並已載入）**：使用者只開了一個對話，OpenCode 自己建立子代理（`ses_e25efd2c…`），該子代理的 `thread=new` 請求最後綁到父對話的 thread `ad0cb826…`。原因：`previousThreadId` 取不到值時，舊的「uuid 有變」檢查會放行；Muse 在點擊後回到上一條 thread。修正：`muse-openai-shim.mjs:725-741` 在綁定前檢查該 threadId 是否已屬於其他 key，是就回 502 且不寫入 map；`muse-driver.mjs:236-240` 先把「點擊前的 thread」等穩定再記錄。已於 21:01 重啟，新碼生效。21:02 已刪除該子代理與 legacy 雜湊鍵的綁定（備份保留），map 現無共用 thread。

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
- 21:00 追加 T32：實機發現子代理拿到父對話的 thread。修正在綁定前檢查 thread 是否已屬於別的 key，是就 502；driver 先把「點擊前的 thread」等穩定。新增 2 個測試（修正前皆失敗）。21:01 依使用者授權重啟（PID `23364`），新碼已生效。21:02 刪除 `ses_e25efd2c…` 與 legacy 雜湊鍵的綁定（備份 `.muse-threads.json.bak-20261114-210224`），再次重啟（PID `33092`）；map 現 26 筆、無共用 thread。
- 21:05 PR #1 本文更新為 73 tests、run 43597353526，並以 GraphQL `markPullRequestReadyForReview` 改為 ready（非 draft）。
- 21:20 第四輪追加 T33／T34：第二次重試只要帶 `error` 就失敗（不再看 reply 是否為空），第二次仍是無效 tool call 時回 502 而不是當文字。`retry-failure` 新增 9 項，修正前 8 項失敗。

## 下一個動作

1. PR #1 說明與狀態已對齊（73 tests、ready for review）；後續只剩實機驗收與審查意見。
2. 剩餘實機驗收 T31（T6b、T6d、T6e、T6f 平行、T6g）需使用者同意後進行。
