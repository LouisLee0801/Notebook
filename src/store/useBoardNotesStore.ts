import { create } from 'zustand'
import type { BoardNote } from '../types'
import { boardItemsRepository } from '../db/whiteboardRepository'

// 便利貼總表（#2）：跨白板列出所有便利貼，供側邊欄顯示。
interface BoardNotesStore {
  notes: BoardNote[]
  load: () => Promise<void>
}

export const useBoardNotesStore = create<BoardNotesStore>((set) => ({
  notes: [],
  load: async () => {
    set({ notes: await boardItemsRepository.listAllNotes() })
  },
}))
