import { db } from './database'
import type { CardTag, Tag, TagProperty } from '../types'

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

  // ---- 標籤即資料庫（features.md 模組 5，P1）：自訂屬性與值 ----

  async addProperty(tagId: string, property: TagProperty): Promise<void> {
    await db.tags
      .where('id')
      .equals(tagId)
      .modify((tag) => {
        tag.properties.push(property)
      })
  },

  /** 移除屬性定義，並清掉所有卡片上的對應值 */
  async removeProperty(tagId: string, propertyId: string): Promise<void> {
    await db.transaction('rw', [db.tags, db.cardTags], async () => {
      await db.tags
        .where('id')
        .equals(tagId)
        .modify((tag) => {
          tag.properties = tag.properties.filter((p) => p.id !== propertyId)
        })
      await db.cardTags
        .where('tagId')
        .equals(tagId)
        .modify((ct) => {
          delete ct.values[propertyId]
        })
    })
  },

  async setValue(
    cardId: string,
    tagId: string,
    propertyId: string,
    value: unknown,
  ): Promise<void> {
    await db.cardTags
      .where('[cardId+tagId]')
      .equals([cardId, tagId])
      .modify((ct) => {
        if (value === null || value === undefined || value === '') delete ct.values[propertyId]
        else ct.values[propertyId] = value
      })
  },
}
