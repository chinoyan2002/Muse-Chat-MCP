# Muse-Chat-MCP 工作計畫

> 最後更新：2026-11-14 02:14（UTC+8）
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
| T6 | Desktop GUI 人工點擊驗收（含 PR 審查 A–J） | PENDING | 使用者依 `ACCEPTANCE-RUN.md` 第 11.3 節操作 |
| T7 | `zod` 4.x 升級 | VERIFIED | `zod@4.6.7`；`npm audit` 0；`mcp-schema` 測試通過；MCP 實機未重跑 |
| T8 | Side chat 建立失敗改為 fail closed | VERIFIED | 建立失敗不送出；不退回目前對話 |
| T9 | Session 識別改用唯一 session id | VERIFIED | 同 session 重用、不同 session 分開、標題請求獨立 |
| T10 | Thread ID 等待與綁定 | VERIFIED | 只接受 `/thread/new`；送出後驗證 uuid 變更 |
| T11 | `tool_choice: required` 契約 | VERIFIED | 散文回覆會重試；仍無則 502 |
| T12 | Windows 路徑 JSON 控制字元 | VERIFIED | `C:\temp\new` 保留反斜線 |
| T13 | Node 24 完整測試 | VERIFIED | v24.19.0（現 52/52） |
| T14 | 第二輪審查 1：session id 順序（不採 affinity、缺 id 回 400） | VERIFIED | `thread-routing` A–G |
| T15 | 第二輪審查 2：SSE 錯誤處理（標頭延後、錯誤事件） | VERIFIED | `sse-errors` 6 項 |
| T16 | 第二輪審查 3：fail-closed 測試改用真實錯誤契約 | VERIFIED | 502＋Map 無新增＋重試仍 newThread；串流結果不得綁舊 thread |
| T17 | 第二輪審查 4：遞迴 JSON Schema 子集合 | VERIFIED | `tool-calling` 巢狀／範圍／enum 案例 |
| T18 | 第二輪審查 5：依賴漏洞與 lockfile | VERIFIED | `zod@4.6.7`、`npm ci --dry-run` 0、audit 0 |
| T19 | 第二輪審查 6：CI Node 22/24 × Ubuntu/Windows | IN_PROGRESS | workflow 已改；**未 push，Actions 未執行** |
| T20 | 第二輪審查 8：README 同步 | VERIFIED | 已更新 session id、SSE 錯誤、schema、測試數 |
| T21 | 測試埠不穩定（fetch 封鎖埠） | VERIFIED | 探測 `/v1/models` 後重綁；`test/shim-port.test.mjs` 回歸測試；連續 28 次全過 |

## 3. 已知限制

- Muse 會跨對話記憶，隔離提示是強約束，不是硬邊界。
- shim 需手動啟動；重開機或登出後要重新執行。
- 尚未建立開機自動啟動（需使用者授權）。

## 4. 變更紀錄

- 2026-11-14：新增 T3、T4、T5，修正併發綁定與散文拒答。
- 2026-11-14 02:14：PR #1 第二輪審查，新增 T14–T20；`zod` 升級、lockfile、CI matrix、SSE 錯誤、schema 驗證。
