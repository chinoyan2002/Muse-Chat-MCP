# Muse-Chat-MCP 工作計畫

> 最後更新：2026-11-14 21:20（UTC+8）
> 分支：`fix/opencode-tool-calling`（追蹤 `fork/fix/opencode-tool-calling`）
> 範圍：把 Meta Muse 接到 OpenCode，並修正實機測試發現的阻斷問題。

## 1. 目標

讓 OpenCode 能透過本機 shim（`muse-server.mjs --serve-only`，`http://127.0.0.1:8787/v1`）
使用 Muse，且能：

1. 呼叫 `read` / `glob` / `shell` / `skill` 等工具並取得結果。
2. 多輪對話不遺失上下文。
3. 不同 OpenCode session 之間不互相污染。

## 2. 任務清單

| ID | 任務 | 狀態 | 驗收條件 |
|---|---|---|---|
| T1 | 修正工具呼叫 JSON（Windows 反斜線、參數名） | VERIFIED | `npm test`；實機 Read/Glob/Shell |
| T2 | 每個對話一個 Muse Side chat（`MUSE_THREAD_MODE`） | VERIFIED | 兩個 session 互不可見；重啟後仍接續 |
| T3 | 併發首請求只建立一個 Side chat | VERIFIED | `test/thread-routing.test.mjs` 併發測試 |
| T4 | Muse 以散文拒答「無法讀取」時重試一次並要求工具呼叫 | VERIFIED | 單元測試 3 項＋實機重現後通過 |
| T5 | shim 崩潰可觀測性（時間戳、uncaught 記錄） | VERIFIED | 日誌含 ISO 時間戳；`npm test` |
| T6 | Desktop GUI 人工驗收（PR 審查 A–J） | IN_PROGRESS | T6a/T6b/T6c/T6f 完成；T6d/T6e/T6g 待做 |
| T6a | Desktop 新 session 三步驟（隔離＋工具） | VERIFIED | 2026-11-14 19:22，ACCEPTANCE §12.4 |
| T6b | A/B 使用完全相同第一句仍開兩個 thread | VERIFIED | 2026-11-14 21:48 shim API 實測（真實 Muse），見 ACCEPTANCE §15 |
| T6c | 同 session 後續訊息回原 thread | VERIFIED | A 第三次請求同 thread，回 FIX-820；§15 再次實測 |
| T6d | Child Session / Subagent 不共用 parent thread | PENDING | 不同 session id 會拿到自己的 thread（§15），但未經真實子代理 |
| T6e | Side chat 建立失敗時 Desktop 顯示錯誤 | PENDING | 尚未實機（自動測試已覆蓋 502） |
| T6f | 平行 tool call／tool result continuation | VERIFIED | continuation 於 19:22 Desktop 實測；同一回覆兩個 tool call 於 §15 實測 |
| T6g | 拒答／假結果重試失敗不當成功 | PENDING | 自動測試 VERIFIED；實機尚未 |
| T7 | `zod` 4.x 升級 | VERIFIED | `zod@4.6.7`；`npm audit` 0；`mcp-schema` 測試通過；MCP 實機未重跑 |
| T8 | Side chat 建立失敗改為 fail closed | VERIFIED | 建立失敗不送出；不退回目前對話 |
| T9 | Session 識別改用唯一 session id | VERIFIED | 同 session 重用、不同 session 分開、標題請求獨立 |
| T10 | Thread ID 等待與綁定 | VERIFIED | 只接受 `/thread/new`；送出後驗證 uuid 變更 |
| T11 | `tool_choice: required` 契約 | VERIFIED | 散文回覆會重試；仍無則 502 |
| T12 | Windows 路徑 JSON 控制字元 | VERIFIED | `C:\temp\new` 保留反斜線 |
| T13 | Node 24 完整測試 | VERIFIED | v24.19.0（現 73/73） |
| T14 | 第二輪審查 1：session id 順序（不採 affinity、缺 id 回 400） | VERIFIED | `thread-routing` A–G |
| T15 | 第二輪審查 2：SSE 錯誤處理（標頭延後、錯誤事件） | VERIFIED | `sse-errors` 6 項 |
| T16 | 第二輪審查 3：fail-closed 測試改用真實錯誤契約 | VERIFIED | 502＋Map 無新增＋重試仍 newThread；串流結果不得綁舊 thread |
| T17 | 第二輪審查 4：遞迴 JSON Schema 子集合 | VERIFIED | `tool-calling` 巢狀／範圍／enum 案例 |
| T18 | 第二輪審查 5：依賴漏洞與 lockfile | VERIFIED | `zod@4.6.7`、`npm ci --dry-run` 0、audit 0 |
| T19 | 第二輪審查 6：CI Node 22/24 × Ubuntu/Windows | VERIFIED | run 43483204976：4/4 jobs success |
| T20 | 第二輪審查 8：README 同步 | VERIFIED | 已更新 session id、SSE 錯誤、schema、測試數 |
| T21 | 測試埠不穩定（fetch 封鎖埠） | VERIFIED | 探測 `/v1/models` 後重綁；`test/shim-port.test.mjs` 回歸測試；最終版連續 10 次全過 |
| T22 | 歷史附件重送 | VERIFIED | `collectFiles` 只看本輪；單元測試 |
| T23 | 假檔案結果（Muse 沙箱）偵測與重試 | VERIFIED | 重試一次；仍假回 502；單元測試 |
| T24 | 工具協議加入宿主平台與沙箱警語 | VERIFIED | `tool-prose-claims.test.mjs` |
| T25 | 移除無用的 Code Mode 目錄 | VERIFIED | 無 code-mode 工具時不送；單元測試 |
| T26 | 重啟 shim 後重跑 Desktop 三步驟 | VERIFIED | `read` 工具實際執行；A/B 不同 thread；B 回 UNKNOWN；A 續回 FIX-820 |
| T27 | 第三輪 P1：重試失敗不得當成功 | VERIFIED | 7 項測試：A–F 皆 502，且不留假結果／不綁錯 thread |
| T27a | 第三輪 P1 補強：外層不以 reply 非空忽略 error | VERIFIED | 非串流錯誤案例 502；driver 只回報**本輪**新出現的錯誤提示，舊提示不誤殺新回覆 |
| T28 | 第三輪 P2：Thread 建立失敗後的併發恢復 | VERIFIED | 3 個併發請求，失敗後僅一次重建，全部落同一 thread |
| T29 | 第三輪 P3：假結果偵測邊界 | VERIFIED | 一般路徑說明不誤判；宣稱目錄列表仍攔截；限制已寫入 README |
| T30 | 第三輪 P4：文件與 PR 說明同步 | VERIFIED | 文件已 push；PR 本文改為 73 tests、run 43597353526，並改為 ready for review |
| T31 | 剩餘實機驗收（T6d、T6e、T6g） | PENDING | 需使用者同意後進行；T6b、T6f 已於 §15 完成 |
| T32 | 第三輪追加：新對話被導回別的 session 的 thread | VERIFIED | `thread-routing` 新案例：子 session 取得父 thread → 502、map 不新增；`thread-map` 新增 `keysFor` |
| T33 | 第四輪 P1：第二次重試帶 error 一律失敗 | VERIFIED | 7 項測試（G–K＋鎖釋放＋map 不綁定）；partial reply／tool call 都不回傳 |
| T34 | 第四輪 P2：第二次仍無效的 tool call 不得當文字 | VERIFIED | `retry-failure` L–O；malformed JSON／未知名稱／參數不符皆 502，auto 散文仍可接受 |

## 3. 已知限制

- Muse 會跨對話記憶，隔離提示是強約束，不是硬邊界。
- shim 需手動啟動；重開機或登出後要重新執行。
- 尚未建立開機自動啟動（需使用者授權）。

## 4. 變更紀錄

- 2026-11-14：新增 T3、T4、T5，修正併發綁定與散文拒答。
- 2026-11-14 02:14：PR #1 第二輪審查，新增 T14–T20；`zod` 升級、lockfile、CI matrix、SSE 錯誤、schema 驗證。
- 2026-11-14 20:30：第三輪審查，新增 T27–T31；重試失敗不得當成功、併發建立恢復、假結果偵測邊界、文件同步。
- 2026-11-14 21:00：第三輪追加 T32；新對話被導回別人的 thread 時回 502，不再共用。21:01 重啟載入，21:02 清理舊綁定。
- 2026-11-14 21:20：第四輪追加 T33／T34；第二次重試只要帶 error 就失敗（含 partial reply／tool call），第二次仍無效的 tool call 不再當一般文字回傳。
