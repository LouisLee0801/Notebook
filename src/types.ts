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
