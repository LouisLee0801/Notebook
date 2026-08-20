// 核心資料模型（對應 docs/data-model.md）。
// M1 僅實作 Card；content 以 TipTap(ProseMirror) 文件 JSON 儲存，
// 對外仍視為 docs/data-model.md 的 Block[] 概念，由 repository 層封裝。

export interface Card {
  id: string
  title: string
  titleHtml?: string | null // 標題格式化 HTML（#3 跨裝置同步）；null = 純文字（用 title）
  content: unknown // TipTap JSON document
  createdAt: number
  updatedAt: number
  archivedAt: number | null
  deletedAt: number | null
  folderId?: string | null // 所屬資料夾（#8），null = 未分類
}

// 資料夾：卡片清單（kind='card'）與白板清單（kind='board'）共用同一張表，
// 以 kind 區分屬於哪一區（舊資料沒有 kind，一律視為卡片資料夾）。
export type FolderKind = 'card' | 'board'

export interface Folder {
  id: string
  name: string
  kind?: FolderKind
  createdAt: number
  updatedAt: number
  collapsed?: boolean // 側邊欄是否收合；跟著帳號同步，換電腦也保留
}

// 白板（docs/data-model.md）
export interface Whiteboard {
  id: string
  name: string
  parentId: string | null
  createdAt: number
  updatedAt: number
  folderId?: string | null // 所屬白板資料夾（#1），null = 未分類
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
  collapsed?: boolean // 在白板上是否收合成只露標題；跟著帳號同步，換電腦也保留
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

// 白板上的具名區域（docs/data-model.md）
export interface Section {
  id: string
  whiteboardId: string
  name: string
  x: number
  y: number
  width: number
  height: number
  collapsed: boolean
}

// 白板上的輕量便利貼（不入卡片庫，features.md 模組 3 P1）
export interface BoardNote {
  id: string
  whiteboardId: string
  text: string
  x: number
  y: number
  width: number
  height: number
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
  color?: string | null // 色票 key（見 components/tagColors.ts），null = 預設
}

export interface CardTag {
  cardId: string
  tagId: string
  values: Record<string, unknown>
  sortOrder?: number // 卡片上的標籤排列順序（可拖曳調整）；舊資料為 undefined
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
    titleHtml: null,
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    deletedAt: null,
    folderId: null,
  }
}
