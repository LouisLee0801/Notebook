import { create } from 'zustand'
import type { BoardNote } from '../types'
import { boardItemsRepository } from '../db/whiteboardRepository'

// 便利貼總表（#2）：跨白板列出所有便利貼，供側邊欄顯示。
interface BoardNotesStore {
  notes: BoardNote[]
  lastRemovedId: string | null // 最近一次被移除的便利貼 id（供開著的白板即時移除節點，#3）
  load: () => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useBoardNotesStore = create<BoardNotesStore>((set) => ({
  notes: [],
  lastRemovedId: null,
  load: async () => {
    set({ notes: await boardItemsRepository.listAllNotes() })
  },
  remove: async (id) => {
    await boardItemsRepository.removeNote(id)
    set({ notes: await boardItemsRepository.listAllNotes(), lastRemovedId: id })
  },
}))
