import { create } from 'zustand'
import type { Whiteboard } from '../types'
import { whiteboardRepository } from '../db/whiteboardRepository'

export type View =
  | { type: 'library' }
  | { type: 'board'; boardId: string }
  | { type: 'journal' }

interface WhiteboardStore {
  boards: Whiteboard[]
  view: View
  load: () => Promise<void>
  openLibrary: () => void
  openBoard: (boardId: string) => void
  openJournal: () => void
  createBoard: () => Promise<void>
  renameBoard: (id: string, name: string) => Promise<void>
  deleteBoard: (id: string) => Promise<void>
}

export const useWhiteboardStore = create<WhiteboardStore>((set, get) => ({
  boards: [],
  view: { type: 'library' },

  load: async () => {
    set({ boards: await whiteboardRepository.list() })
  },

  openLibrary: () => set({ view: { type: 'library' } }),
  openBoard: (boardId) => set({ view: { type: 'board', boardId } }),
  openJournal: () => set({ view: { type: 'journal' } }),

  createBoard: async () => {
    const board = await whiteboardRepository.create(`白板 ${get().boards.length + 1}`)
    set({ boards: [board, ...get().boards], view: { type: 'board', boardId: board.id } })
  },

  renameBoard: async (id, name) => {
    await whiteboardRepository.rename(id, name)
    set({ boards: get().boards.map((b) => (b.id === id ? { ...b, name } : b)) })
  },

  deleteBoard: async (id) => {
    await whiteboardRepository.remove(id)
    const { view, boards } = get()
    set({
      boards: boards.filter((b) => b.id !== id),
      view: view.type === 'board' && view.boardId === id ? { type: 'library' } : view,
    })
  },
}))
