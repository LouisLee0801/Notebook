# 開發計畫

三套 Plan，差別在於**上線速度、架構複雜度、最終能走多遠**。建議先讀完再選一套；三套的前期程式碼有很大重疊，之後升級路徑也標在最後。

功能編號對應 [features.md](features.md) 的模組與優先級。

---

## Plan A — 本地優先 Web App（推薦起手式）

> 目標：最快做出「能每天自己用」的核心產品。單人使用、資料存在瀏覽器/本機，不做帳號與同步。

### 技術選型

| 層 | 選擇 | 理由 |
| --- | --- | --- |
| 前端框架 | React + TypeScript + Vite | 生態最完整，後述套件都有一級支援 |
| 編輯器 | TipTap（ProseMirror） | Block 編輯、`[[` 連結、slash menu 都有現成擴充模式 |
| 白板 | React Flow（或 tldraw） | 無限畫布 + 節點 + 連線開箱即用，省掉最難的畫布工程 |
| 狀態 | Zustand | 輕量，配合本地 DB 即可 |
| 本地儲存 | SQLite WASM（sqlite.org 官方 wasm）+ OPFS，或 Dexie（IndexedDB） | 結構化查詢（反向連結、標籤篩選）比純 KV 好做 |
| 全文搜尋 | SQLite FTS5（或 MiniSearch） | 免伺服器 |
| 樣式 | Tailwind CSS | 快速迭代 |

### 里程碑

**M1（週 1–2）：卡片 + 編輯器骨架**
- 專案腳手架、資料層（data-model.md 的 Card/Block schema）
- TipTap 編輯器：P0 區塊、行內格式、Markdown 快捷、slash menu
- 卡片庫列表 + 卡片 CRUD
- ✅ 驗收：能建立、編輯、刪除卡片，重新整理不掉資料

**M2（週 3–4）：白板**
- React Flow 畫布：平移縮放、卡片節點（內嵌 TipTap 唯讀/點擊編輯）
- 從卡片庫拖入既有卡片、白板上直接新建卡片
- 連線 + 箭頭 + 線上標籤；多選、框選
- 白板 CRUD + 側邊欄導航
- ✅ 驗收：同一張卡片放上兩個白板，改一處另一處同步

**M3（週 5）：雙向連結 + 日誌**
- `[[` 觸發卡片搜尋與插入；存檔時解析重建 CardLink
- 卡片資訊面板：反向連結列表（含上下文）
- Journal：每日一頁、時間軸捲動、今日直達
- ✅ 驗收：日誌裡 `[[某卡片]]`，該卡片的反向連結看得到這則日誌

**M4（週 6）：搜尋 + 收尾**
- FTS5 全文搜尋、Cmd+K 快速開啟
- 標籤 CRUD 與標籤頁（先做簡單列表，資料庫檢視留給下一階段）
- Markdown 匯出、垃圾桶
- ✅ 驗收：MVP 完成，自己開始每天用（dogfooding）

**M5+（週 7–10）：P1 深化**
- 標籤資料庫：自訂屬性、表格/看板檢視
- Section 區域、卡片顏色、便利貼、分割視窗
- 未連結提及、連結預覽浮窗
- 圖片/程式碼/表格區塊

### 優缺點
- ✅ 6 週內有可用產品；無後端維運成本；架構最簡單
- ❌ 無多裝置同步、無行動端；之後上同步要補帳號與衝突處理

---

## Plan B — 桌面 App（Tauri，本地優先 + 檔案系統）

> 目標：做成像 Heptabase 桌面版的原生體驗，資料存在本機 SQLite 檔案，效能與離線體驗最好。

### 技術選型

- **殼**：Tauri 2（Rust 核心，比 Electron 輕量一個數量級）
- **前端**：與 Plan A 完全相同（React + TipTap + React Flow）
- **儲存**：原生 SQLite（tauri-plugin-sql）+ 使用者可見的資料資料夾；附件直接存檔案系統
- **搜尋**：SQLite FTS5

### 里程碑

- **M1–M4**：同 Plan A（前端程式碼共用，僅資料層走 Tauri IPC 到原生 SQLite）
- **M5（週 7）**：桌面整合 — 全域快捷鍵快速捕捉、系統匣、多視窗、自動更新
- **M6（週 8–9）**：PDF 模組 — pdf.js 閱讀器、劃線 highlight、標註上板（桌面檔案系統讓大 PDF 體驗最好）
- **M7（週 10+）**：Markdown 資料夾匯入/匯出、本地備份與版本快照

### 優缺點
- ✅ 原生效能與離線體驗；資料完全自持（一個資料夾）；PDF 等重功能體驗最佳
- ❌ 需要打包、簽章、自動更新等發佈工程；仍無跨裝置同步；Rust 端有學習成本

---

## Plan C — 全端 SaaS（多裝置同步 + 協作路線）

> 目標：對齊 Heptabase 完整產品形態 — 帳號、雲端即時同步、之後可加分享與協作。工程量最大，適合已驗證需求後投入。

### 技術選型

| 層 | 選擇 | 理由 |
| --- | --- | --- |
| 前端 | 同 Plan A | 共用 |
| 同步引擎 | **Yjs（CRDT）** + Hocuspocus server | 卡片內容與白板狀態都建成 Y.Doc，離線編輯、衝突合併、即時協作一次解決 |
| 後端 | Node.js（Hono/Fastify）+ Postgres | 帳號、權限、文件索引、搜尋 |
| 儲存 | Postgres（文件快照 + 關聯索引）、S3/R2（圖片、PDF） |
| 認證 | Auth.js 或 Clerk | Email + OAuth |
| 全文搜尋 | Postgres tsvector 起步，需要再上 Meilisearch |
| 部署 | Docker + Fly.io/Railway；前端 Vercel |

### 架構要點

```
Client (React)
  ├─ Y.Doc per card / per whiteboard（本地 IndexedDB 持久化 → 離線可用）
  ├─ y-websocket ↔ Hocuspocus（即時同步）
  └─ REST/tRPC ↔ API server（列表、搜尋、標籤查詢、權限）
Server
  ├─ Hocuspocus：CRDT 收斂、寫入快照
  ├─ 快照 hook：解析 [[連結]] 與標籤 → 更新 Postgres 索引（反向連結/搜尋用）
  └─ Postgres + S3
```

關鍵設計：**即時性資料走 CRDT，可查詢性資料走 Postgres 索引**。反向連結、標籤表格、全文搜尋都查索引，不掃 Y.Doc。

### 里程碑

- **M1（週 1–2）**：Monorepo（pnpm + Turborepo）、帳號系統、Postgres schema
- **M2（週 3–5）**：編輯器 + 卡片庫（TipTap 綁 Yjs collaboration extension）
- **M3（週 6–8）**：白板（React Flow 狀態存 Y.Doc）、多裝置同步驗證、離線→重連收斂
- **M4（週 9–10）**：雙向連結索引、日誌、全文搜尋、Cmd+K
- **M5（週 11–12）**：標籤資料庫（屬性、表格/看板）
- **M6（週 13+）**：白板唯讀分享連結 → 即時協作（presence/游標，Yjs 原生支援）→ PDF 模組 → 行動端（React Native 或 PWA，先做日誌捕捉）

### 優缺點
- ✅ 唯一能走到多裝置同步、分享、協作的路線；CRDT 從第一天就位，不用日後重構
- ❌ 前 4 週都在打地基，看不到產品；維運成本（伺服器、資料庫、儲存）；Yjs 學習曲線陡

---

## 三案比較與建議

| | Plan A（Web 本地） | Plan B（Tauri 桌面） | Plan C（SaaS） |
| --- | --- | --- | --- |
| 首個可用版本 | ~6 週 | ~7 週 | ~10 週 |
| 多裝置同步 | ✗ | ✗ | ✅ |
| 協作/分享 | ✗ | ✗ | ✅（M6） |
| 離線體驗 | ✅ | ✅✅ | ✅ |
| 維運成本 | 零 | 零（有發佈工程） | 中高 |
| 適合情境 | 快速驗證、自用 | 個人工具、重 PDF | 產品化、多人 |

---

## ✅ 選定方案：Plan A+ —— Web App + Supabase 雲端同步

> 需求已確認：**單人使用、跨電腦、雲端同步必備、不需多人協作**。
> 完整 Plan C（Yjs CRDT + 自架同步伺服器）是為「多人即時協作」設計的，對單人同步是過度工程；
> 純 Plan A 又缺同步。因此採用中間路線：**Plan A 的前端 + Supabase 當現成後端**。

### 與 Plan A 的差異

| 層 | Plan A | Plan A+ |
| --- | --- | --- |
| 儲存 | 本機 SQLite WASM | **Supabase Postgres**（雲端單一資料來源）+ IndexedDB 本地快取 |
| 帳號 | 無 | **Supabase Auth**（Email / Google 登入） |
| 同步 | 無 | Supabase Realtime 訂閱變更 → 開著的另一台電腦即時更新 |
| 附件 | — | Supabase Storage（圖片、之後的 PDF） |
| 全文搜尋 | SQLite FTS5 | Postgres tsvector（Supabase 內建） |
| 部署 | 本機跑 | 前端丟 Vercel / Cloudflare Pages，**任何電腦開瀏覽器登入即用** |

同步策略（單人夠用、實作簡單）：
- 每筆記錄帶 `updatedAt`，寫入採 **last-write-wins**；單人跨裝置幾乎不會真的衝突。
- 編輯時 debounce 直接寫 Supabase；離線時寫本地佇列，上線後重放。
- 免費方案（500MB DB + 1GB Storage）對個人筆記綽綽有餘，維運工作趨近於零。

### 里程碑調整

- **M0（週 1 前半）**：建 Supabase 專案、Auth 登入頁、資料表 schema（照 data-model.md）+ Row Level Security（只有自己讀寫自己的資料）
- **M1–M4**：同 Plan A 的內容，但 repository 層直接對 Supabase 讀寫（本地快取讓 UI 不卡）
- **M4 驗收改為**：在兩台電腦登入同帳號，A 電腦改卡片，B 電腦重新整理（或即時）看到更新
- **M5+**：同 Plan A；若日後要多人協作再把熱點資料換成 Yjs（升級到 Plan C 的路徑不變）

### 其他 Plan 的定位（保留備查）

1. 前端（編輯器、白板、UI）在所有 Plan 之間**幾乎 100% 共用**，不會白做。
2. Plan B（Tauri 桌面版）之後可加掛在同一套前端上，配 Supabase 一樣能同步。
3. 若未來要多人協作/分享，再升級 Plan C：資料層抽換成 Yjs + 同步伺服器。前提同樣是「資料存取收斂在 repository 層」——這點請在 M1 就遵守。

## 共通工程守則（無論選哪個 Plan）

- 資料存取全部走 repository 層，UI 不直接碰 DB —— 為未來換同步引擎留門。
- 從 M1 起就建立：TypeScript strict、ESLint、Vitest 單元測試、Playwright 針對「建卡→上板→連結→搜尋」的核心 happy path E2E。
- 每個里程碑結束打 tag，維持 main 隨時可 demo。
- UI 文案、圖示、視覺全部原創，不使用 Heptabase 的素材。
