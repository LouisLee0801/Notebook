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

請先閱讀 [docs/development-plans.md](docs/development-plans.md)，選定一套 Plan 後依里程碑進行。
