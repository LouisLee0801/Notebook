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

  /** 垃圾桶內容，依刪除時間新→舊 */
  async listTrashed(): Promise<Card[]> {
    const cards = await db.cards.filter((c) => c.deletedAt !== null).toArray()
    return cards.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
  },

  async restore(id: string, now = Date.now()): Promise<void> {
    await db.cards.update(id, { deletedAt: null, updatedAt: now })
  },

  /** 永久刪除：連同白板實例、相關連線、雙向連結與標籤關聯一併清除 */
  async hardDelete(id: string): Promise<void> {
    await db.transaction(
      'rw',
      [db.cards, db.cardInstances, db.boardEdges, db.cardLinks, db.cardTags],
      async () => {
        const instances = await db.cardInstances.where('cardId').equals(id).toArray()
        for (const instance of instances) {
          await db.boardEdges.where('fromInstanceId').equals(instance.id).delete()
          await db.boardEdges.where('toInstanceId').equals(instance.id).delete()
        }
        await db.cardInstances.where('cardId').equals(id).delete()
        await db.cardLinks.where('fromCardId').equals(id).delete()
        await db.cardLinks.where('toCardId').equals(id).delete()
        await db.cardTags.where('cardId').equals(id).delete()
        await db.cards.delete(id)
      },
    )
  },
}
