# 核心資料模型草案

以「卡片與白板解耦、多對多引用」為核心設計。以下用 TypeScript 型別描述，實作時可對應到 SQLite / Postgres schema。

```ts
// 卡片：內容的單一來源
interface Card {
  id: string;              // uuid
  title: string;
  content: Block[];        // block-based 內容（JSON）
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
  deletedAt: number | null; // 垃圾桶
}

// 編輯器區塊
interface Block {
  id: string;
  type: 'paragraph' | 'heading' | 'list' | 'todo' | 'quote'
      | 'divider' | 'image' | 'code' | 'table' | 'embed';
  props: Record<string, unknown>; // level、checked、language…
  content: InlineNode[];          // 文字 + 格式 + 行內連結
  children: Block[];              // 巢狀清單
}

// 白板
interface Whiteboard {
  id: string;
  name: string;
  parentId: string | null; // 子白板
  createdAt: number;
  updatedAt: number;
}

// 卡片「出現在」白板上的實例（多對多 + 空間資訊）
interface CardInstance {
  id: string;
  whiteboardId: string;
  cardId: string;
  x: number;
  y: number;
  width: number;
  height: number;          // 或 auto
  color: string | null;
  sectionId: string | null;
}

// 白板上的連線
interface Edge {
  id: string;
  whiteboardId: string;
  fromInstanceId: string;
  toInstanceId: string;
  label: string | null;
  arrow: 'none' | 'forward' | 'both';
}

// 白板上的區域
interface Section {
  id: string;
  whiteboardId: string;
  name: string;
  x: number; y: number; width: number; height: number;
  collapsed: boolean;
}

// 卡片間的引用（由編輯器內 [[連結]] 解析而來，用於反向連結）
interface CardLink {
  fromCardId: string;
  fromBlockId: string;
  toCardId: string;
}

// 標籤與屬性
interface Tag {
  id: string;
  name: string;            // 支援 a/b 巢狀命名
  properties: TagProperty[];
}
interface TagProperty {
  id: string;
  name: string;
  type: 'text' | 'number' | 'select' | 'multiSelect' | 'date' | 'checkbox';
  options?: string[];      // select 選項
}
interface CardTag {
  cardId: string;
  tagId: string;
  values: Record<string, unknown>; // propertyId -> 值
}

// 日誌：本質上是「以日期為 key 的特殊卡片」
interface JournalEntry {
  date: string;            // YYYY-MM-DD，主鍵
  cardId: string;          // 內容仍存為 Card，重用編輯器與連結機制
}
```

## 設計要點

1. **Card 與 CardInstance 分離**：卡片內容只有一份，位置/大小/顏色屬於白板上的實例。這是「一卡多板」的關鍵。
2. **CardLink 由系統維護**：儲存卡片時解析內文的 `[[連結]]` 重建 CardLink，反向連結面板直接查 `toCardId = 自己`。
3. **Journal 重用 Card**：日誌頁就是一張以日期索引的卡片，雙向連結、上板、搜尋全部免費獲得。
4. **所有刪除都是軟刪除**（`deletedAt`），支援垃圾桶還原。
5. **同步友善**：每筆記錄帶 `updatedAt`，之後上雲端同步時可用 LWW 或改造成 CRDT（見開發計畫）。
