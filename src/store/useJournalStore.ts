import { create } from 'zustand'
import type { JournalEntry } from '../types'
import { journalRepository, todayString } from '../db/journalRepository'
import { useCardStore } from './useCardStore'

interface JournalStore {
  entries: JournalEntry[] // 新→舊
  journalCardIds: Set<string>
  load: () => Promise<void>
  /** 確保今天的日誌存在（開啟日誌視圖時呼叫） */
  ensureToday: () => Promise<void>
  /** 確保指定日期的日誌存在（點日曆時呼叫），回傳其 cardId */
  ensureDate: (date: string) => Promise<string>
}

export const useJournalStore = create<JournalStore>((set) => ({
  entries: [],
  journalCardIds: new Set(),

  load: async () => {
    const entries = await journalRepository.list()
    set({ entries, journalCardIds: new Set(entries.map((e) => e.cardId)) })
  },

  ensureToday: async () => {
    await journalRepository.getOrCreate(todayString())
    const entries = await journalRepository.list()
    set({ entries, journalCardIds: new Set(entries.map((e) => e.cardId)) })
    // 今天的卡片是新建立的話，讓卡片 store 也拿到它
    await useCardStore.getState().load()
  },

  ensureDate: async (date) => {
    const entry = await journalRepository.getOrCreate(date)
    const entries = await journalRepository.list()
    set({ entries, journalCardIds: new Set(entries.map((e) => e.cardId)) })
    await useCardStore.getState().load()
    return entry.cardId
  },
}))
