// 核心資料模型（對應 docs/data-model.md）。
// M1 僅實作 Card；content 以 TipTap(ProseMirror) 文件 JSON 儲存，
// 對外仍視為 docs/data-model.md 的 Block[] 概念，由 repository 層封裝。

export interface Card {
  id: string
  title: string
  content: unknown // TipTap JSON document
  createdAt: number
  updatedAt: number
  archivedAt: number | null
  deletedAt: number | null
}

// 白板（docs/data-model.md）
export interface Whiteboard {
  id: string
  name: string
  parentId: string | null
  createdAt: number
  updatedAt: number
}

// 卡片「出現在」白板上的實例（多對多 + 空間資訊）
export interface CardInstance {
  id: string
  whiteboardId: string
  cardId: string
  x: number
  y: number
  width: number
  height: number // 0 = 依內容自動
  color: string | null
  sectionId: string | null
}

// 白板上的連線（避免與 React Flow 的 Edge 型別撞名，取名 BoardEdge）
export interface BoardEdge {
  id: string
  whiteboardId: string
  fromInstanceId: string
  toInstanceId: string
  label: string | null
  arrow: 'none' | 'forward' | 'both'
}

// 卡片間引用（由編輯器內 cardLink 節點解析而來，用於反向連結）
export interface CardLink {
  fromCardId: string
  fromBlockId: string
  toCardId: string
}

// 標籤與屬性（M4 先做簡單標籤；properties 供 M5 標籤資料庫使用）
export interface TagProperty {
  id: string
  name: string
  type: 'text' | 'number' | 'select' | 'multiSelect' | 'date' | 'checkbox'
  options?: string[]
}

export interface Tag {
  id: string
  name: string
  properties: TagProperty[]
}

export interface CardTag {
  cardId: string
  tagId: string
  values: Record<string, unknown>
}

// 日誌：以日期為 key 的特殊卡片（重用 Card 與連結機制）
export interface JournalEntry {
  date: string // YYYY-MM-DD
  cardId: string
}

export function createEmptyCard(now: number): Card {
  return {
    id: crypto.randomUUID(),
    title: '',
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    deletedAt: null,
  }
}
