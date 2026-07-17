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
- [ ] M2 白板
- [ ] M3 雙向連結 + 日誌
- [ ] M4 搜尋 + 收尾
- [ ] M0/同步：Supabase（帳號 + 雲端同步）
