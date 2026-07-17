import { db } from './database'
import type { CardTag, Tag } from '../types'

export const tagRepository = {
  async list(): Promise<Tag[]> {
    return db.tags.orderBy('name').toArray()
  },

  async listCardTags(): Promise<CardTag[]> {
    return db.cardTags.toArray()
  },

  /** 依名稱取得或建立標籤 */
  async getOrCreate(name: string): Promise<Tag> {
    const trimmed = name.trim()
    const existing = await db.tags.where('name').equals(trimmed).first()
    if (existing) return existing
    const tag: Tag = { id: crypto.randomUUID(), name: trimmed, properties: [] }
    await db.tags.add(tag)
    return tag
  },

  async rename(id: string, name: string): Promise<void> {
    await db.tags.update(id, { name: name.trim() })
  },

  /** 刪除標籤與所有卡片關聯 */
  async remove(id: string): Promise<void> {
    await db.transaction('rw', [db.tags, db.cardTags], async () => {
      await db.cardTags.where('tagId').equals(id).delete()
      await db.tags.delete(id)
    })
  },

  async addToCard(cardId: string, tagId: string): Promise<void> {
    await db.cardTags.put({ cardId, tagId, values: {} })
  },

  async removeFromCard(cardId: string, tagId: string): Promise<void> {
    await db.cardTags.delete([cardId, tagId])
  },
}
