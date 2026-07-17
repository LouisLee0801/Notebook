import { create } from 'zustand'
import type { CardTag, Tag } from '../types'
import { tagRepository } from '../db/tagRepository'

interface TagStore {
  tags: Tag[]
  cardTags: CardTag[]
  load: () => Promise<void>
  addTagToCard: (cardId: string, name: string) => Promise<void>
  removeTagFromCard: (cardId: string, tagId: string) => Promise<void>
  renameTag: (id: string, name: string) => Promise<void>
  deleteTag: (id: string) => Promise<void>
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

  deleteTag: async (id) => {
    await tagRepository.remove(id)
    set({
      tags: get().tags.filter((t) => t.id !== id),
      cardTags: get().cardTags.filter((ct) => ct.tagId !== id),
    })
  },
}))
