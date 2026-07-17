import { db } from './database'
import { createEmptyCard, type Card } from '../types'

// 所有資料存取都走 repository 層（docs/development-plans.md 共通工程守則），
// 之後接 Supabase 時只需替換此檔的實作。

export const cardRepository = {
  /** 未刪除、未封存的卡片，依更新時間新→舊 */
  async list(): Promise<Card[]> {
    const cards = await db.cards
      .orderBy('updatedAt')
      .reverse()
      .filter((c) => c.deletedAt === null && c.archivedAt === null)
      .toArray()
    return cards
  },

  async get(id: string): Promise<Card | undefined> {
    return db.cards.get(id)
  },

  async create(now = Date.now()): Promise<Card> {
    const card = createEmptyCard(now)
    await db.cards.add(card)
    return card
  },

  async update(
    id: string,
    patch: Partial<Pick<Card, 'title' | 'content' | 'archivedAt'>>,
    now = Date.now(),
  ): Promise<void> {
    await db.cards.update(id, { ...patch, updatedAt: now })
  },

  /** 軟刪除（進垃圾桶，data-model.md 設計要點 4） */
  async softDelete(id: string, now = Date.now()): Promise<void> {
    await db.cards.update(id, { deletedAt: now, updatedAt: now })
  },
}
