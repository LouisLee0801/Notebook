import { create } from 'zustand'
import type { Whiteboard } from '../types'
import { whiteboardRepository } from '../db/whiteboardRepository'

export type View =
  | { type: 'library' }
  | { type: 'board'; boardId: string }
  | { type: 'journal' }
  | { type: 'tag'; tagId: string }
  | { type: 'trash' }
  | { type: 'account' }

interface WhiteboardStore {
  boards: Whiteboard[]
  view: View
  load: () => Promise<void>
  openLibrary: () => void
  openBoard: (boardId: string) => void
  openJournal: () => void
  openTag: (tagId: string) => void
  openTrash: () => void
  openAccount: () => void
  createBoard: (folderId?: string | null) => Promise<void>
  renameBoard: (id: string, name: string) => Promise<void>
  deleteBoard: (id: string) => Promise<void>
  /** 把白板搬進資料夾（null = 未分類）（#1） */
  moveBoardsToFolder: (ids: string[], folderId: string | null) => Promise<void>
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
  openTag: (tagId) => set({ view: { type: 'tag', tagId } }),
  openTrash: () => set({ view: { type: 'trash' } }),
  openAccount: () => set({ view: { type: 'account' } }),

  createBoard: async (folderId = null) => {
    const board = await whiteboardRepository.create(`白板 ${get().boards.length + 1}`, folderId)
    set({ boards: [board, ...get().boards], view: { type: 'board', boardId: board.id } })
  },

  renameBoard: async (id, name) => {
    await whiteboardRepository.rename(id, name)
    set({ boards: get().boards.map((b) => (b.id === id ? { ...b, name } : b)) })
  },

  moveBoardsToFolder: async (ids, folderId) => {
    await whiteboardRepository.setFolder(ids, folderId)
    const moving = new Set(ids)
    set({ boards: get().boards.map((b) => (moving.has(b.id) ? { ...b, folderId } : b)) })
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
