import { create } from 'zustand'
import type { CardTag, Tag, TagProperty } from '../types'
import { tagRepository } from '../db/tagRepository'

interface TagStore {
  tags: Tag[]
  cardTags: CardTag[]
  load: () => Promise<void>
  addTagToCard: (cardId: string, name: string) => Promise<void>
  /** 一次掛上多個既有標籤（#4 多選） */
  addTagsToCard: (cardId: string, tagIds: string[]) => Promise<void>
  removeTagFromCard: (cardId: string, tagId: string) => Promise<void>
  /** 依給定順序重排卡片上的標籤（#4 拖曳排序） */
  reorderCardTags: (cardId: string, tagIds: string[]) => Promise<void>
  renameTag: (id: string, name: string) => Promise<void>
  setTagColor: (id: string, color: string | null) => Promise<void>
  deleteTag: (id: string) => Promise<void>
  addProperty: (tagId: string, property: TagProperty) => Promise<void>
  removeProperty: (tagId: string, propertyId: string) => Promise<void>
  setValue: (cardId: string, tagId: string, propertyId: string, value: unknown) => Promise<void>
}

export const useTagStore = create<TagStore>((set, get) => ({
  tags: [],
  cardTags: [],

  load: async () => {
    const [tags, cardTags] = await Promise.all([
      tagRepository.list(),
      tagRepository.listCardTags(),
    ])
    set({ tags, cardTags })
  },

  addTagToCard: async (cardId, name) => {
    const tag = await tagRepository.getOrCreate(name)
    await tagRepository.addToCard(cardId, tag.id)
    await get().load()
  },

  addTagsToCard: async (cardId, tagIds) => {
    for (const tagId of tagIds) await tagRepository.addToCard(cardId, tagId)
    await get().load()
  },

  reorderCardTags: async (cardId, tagIds) => {
    await tagRepository.reorderCardTags(cardId, tagIds)
    const order = new Map(tagIds.map((id, i) => [id, i + 1]))
    set({
      cardTags: get().cardTags.map((ct) =>
        ct.cardId === cardId && order.has(ct.tagId) ? { ...ct, sortOrder: order.get(ct.tagId) } : ct,
      ),
    })
  },

  removeTagFromCard: async (cardId, tagId) => {
    await tagRepository.removeFromCard(cardId, tagId)
    set({
      cardTags: get().cardTags.filter((ct) => !(ct.cardId === cardId && ct.tagId === tagId)),
    })
  },

  renameTag: async (id, name) => {
    await tagRepository.rename(id, name)
    set({ tags: get().tags.map((t) => (t.id === id ? { ...t, name } : t)) })
  },

  setTagColor: async (id, color) => {
    await tagRepository.setColor(id, color)
    set({ tags: get().tags.map((t) => (t.id === id ? { ...t, color } : t)) })
  },

  deleteTag: async (id) => {
    await tagRepository.remove(id)
    set({
      tags: get().tags.filter((t) => t.id !== id),
      cardTags: get().cardTags.filter((ct) => ct.tagId !== id),
    })
  },

  addProperty: async (tagId, property) => {
    await tagRepository.addProperty(tagId, property)
    await get().load()
  },

  removeProperty: async (tagId, propertyId) => {
    await tagRepository.removeProperty(tagId, propertyId)
    await get().load()
  },

  setValue: async (cardId, tagId, propertyId, value) => {
    await tagRepository.setValue(cardId, tagId, propertyId, value)
    set({
      cardTags: get().cardTags.map((ct) => {
        if (ct.cardId !== cardId || ct.tagId !== tagId) return ct
        const values = { ...ct.values }
        if (value === null || value === undefined || value === '') delete values[propertyId]
        else values[propertyId] = value
        return { ...ct, values }
      }),
    })
  },
}))
