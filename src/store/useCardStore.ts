import { create } from 'zustand'
import type { Card } from '../types'
import { cardRepository } from '../db/cardRepository'
import { linkRepository } from '../db/linkRepository'

interface CardStore {
  cards: Card[]
  selectedId: string | null
  loaded: boolean
  load: () => Promise<void>
  select: (id: string | null) => void
  createCard: (folderId?: string | null) => Promise<Card>
  updateCard: (
    id: string,
    patch: Partial<Pick<Card, 'title' | 'titleHtml' | 'content'>>,
  ) => Promise<void>
  moveCardToFolder: (cardId: string, folderId: string | null) => Promise<void>
  moveCardsToFolder: (cardIds: string[], folderId: string | null) => Promise<void>
  deleteCard: (id: string) => Promise<void>
  deleteCards: (ids: string[]) => Promise<void>
}

export const useCardStore = create<CardStore>((set, get) => ({
  cards: [],
  selectedId: null,
  loaded: false,

  load: async () => {
    const cards = await cardRepository.list()
    set({ cards, loaded: true })
  },

  select: (id) => set({ selectedId: id }),

  createCard: async (folderId = null) => {
    const card = await cardRepository.create(Date.now(), folderId)
    set({ cards: [card, ...get().cards], selectedId: card.id })
    return card
  },

  updateCard: async (id, patch) => {
    await cardRepository.update(id, patch)
    // 存檔時重建對外連結（docs/data-model.md 設計要點 2）
    if (patch.content !== undefined) await linkRepository.rebuildFromContent(id, patch.content)
    const now = Date.now()
    const cards = get()
      .cards.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: now } : c))
      .sort((a, b) => b.updatedAt - a.updatedAt)
    set({ cards })
  },

  moveCardToFolder: async (cardId, folderId) => {
    await cardRepository.update(cardId, { folderId })
    const now = Date.now()
    set({
      cards: get()
        .cards.map((c) => (c.id === cardId ? { ...c, folderId, updatedAt: now } : c))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    })
  },

  moveCardsToFolder: async (cardIds, folderId) => {
    const ids = new Set(cardIds)
    for (const id of cardIds) await cardRepository.update(id, { folderId })
    const now = Date.now()
    set({
      cards: get()
        .cards.map((c) => (ids.has(c.id) ? { ...c, folderId, updatedAt: now } : c))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    })
  },

  deleteCard: async (id) => {
    await cardRepository.softDelete(id)
    const cards = get().cards.filter((c) => c.id !== id)
    set({ cards, selectedId: get().selectedId === id ? null : get().selectedId })
  },

  deleteCards: async (ids) => {
    for (const id of ids) await cardRepository.softDelete(id)
    const idSet = new Set(ids)
    const cards = get().cards.filter((c) => !idSet.has(c.id))
    set({
      cards,
      selectedId: get().selectedId && idSet.has(get().selectedId!) ? null : get().selectedId,
    })
  },
}))
