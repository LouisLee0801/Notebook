# Notebook — 視覺化知識管理筆記本

一個以 Heptabase 為功能藍本的視覺化筆記軟體：以「卡片（Card）」為最小知識單位、以「白板（Whiteboard）」為思考空間，支援雙向連結、標籤資料庫、日誌、PDF 標註與全文搜尋。

> 注意：本專案參考的是 Heptabase 的**功能概念**，所有 UI 設計、文案與程式碼皆為原創實作。

## 文件導覽

| 文件 | 內容 |
| --- | --- |
| [docs/features.md](docs/features.md) | 完整功能規格清單（依模組拆分，含優先級） |
| [docs/development-plans.md](docs/development-plans.md) | 三套可選的開發計畫（技術選型 + 里程碑） |
| [docs/data-model.md](docs/data-model.md) | 核心資料模型草案 |

## 核心概念

- **Card 卡片**：最小知識單位，一張卡片一個想法，可被多個白板重複引用。
- **Whiteboard 白板**：無限畫布，把卡片攤開、排列、連線，用空間關係思考。
- **Journal 日誌**：每天一頁的時間軸入口，快速捕捉想法。
- **Tag 標籤**：不只是分類，還能變成資料庫（表格/看板檢視 + 自訂屬性）。
- **雙向連結**：`[[卡片]]` 引用，自動產生反向連結，形成知識網絡。

## 開始開發

已採用 [docs/development-plans.md](docs/development-plans.md) 選定的 **Plan A+**（React + TypeScript + Vite + Tailwind + Zustand + Dexie + TipTap，之後接 Supabase 同步）。

```bash
npm install
npm run dev      # 開發伺服器 http://localhost:5173
npm run test     # Vitest 單元測試
npm run lint     # ESLint
npm run build    # 型別檢查 + 產出 dist/
npm run e2e      # 核心流程冒煙測試（需先啟動 dev server）
```

### 進度

- [x] **M1** 卡片 + 編輯器骨架：卡片 CRUD（軟刪除）、卡片庫、TipTap block 編輯器（P0 區塊、行內格式、Markdown 快捷、`/` 指令選單）、IndexedDB 本地持久化
- [x] **M2** 白板：React Flow 無限畫布（平移縮放）、雙擊/拖曳上板、一卡多板內容同步、移動與縮放卡片、多選框選、箭頭連線＋雙擊編輯線上標籤、白板 CRUD 與側邊欄導航
- [x] **M3** 雙向連結 + 日誌：`[[` 搜尋插入卡片連結（查無卡片可直接建立）、存檔重建 CardLink、反向連結面板（含上下文預覽）、日誌每日一頁／時間軸／今日直達、連結 chip 點擊導航
- [x] **M4** 搜尋 + 收尾（MVP 完成 🎉）：全文搜尋 + Ctrl/⌘+K 快速開啟（卡片／白板／指令）、標籤 CRUD 與標籤頁、Markdown 匯出（單卡與整庫）、垃圾桶（還原／永久刪除）
- [x] **M5（第一部分）** 標籤資料庫：自訂屬性（文字／數字／單選／多選／日期／勾選）、表格檢視（欄位排序、儲存格直接編輯）、看板檢視（依單選屬性分欄、拖曳改值）
- [x] **M5（第二部分）** 白板深化：Section 具名區域（可縮放，拖曳時帶動區域內卡片與便利貼）、便利貼（點選編輯、拖曳移動）、卡片顏色（實例層級，六色工具列）、卡片連結 hover 預覽浮窗
- [ ] M5+ 其餘 P1（分割視窗、未連結提及、對齊輔助、小地圖…）
- [ ] M0/同步：Supabase（帳號 + 雲端同步）
