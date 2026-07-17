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
  createCard: () => Promise<Card>
  updateCard: (id: string, patch: Partial<Pick<Card, 'title' | 'content'>>) => Promise<void>
  deleteCard: (id: string) => Promise<void>
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

  createCard: async () => {
    const card = await cardRepository.create()
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

  deleteCard: async (id) => {
    await cardRepository.softDelete(id)
    const cards = get().cards.filter((c) => c.id !== id)
    set({ cards, selectedId: get().selectedId === id ? null : get().selectedId })
  },
}))
