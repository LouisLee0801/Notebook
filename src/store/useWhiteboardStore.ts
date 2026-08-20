import { create } from 'zustand'
import type { Whiteboard } from '../types'
import { whiteboardRepository } from '../db/whiteboardRepository'
import { useCardStore } from './useCardStore'

export type View =
  | { type: 'library' }
  | { type: 'board'; boardId: string }
  | { type: 'journal' }
  | { type: 'tag'; tagId: string }
  | { type: 'trash' }
  | { type: 'account' }

// 瀏覽記錄的一站：檢視 + 當時選取的卡片（#5 上一頁）
interface NavEntry {
  view: View
  cardId: string | null
}

interface WhiteboardStore {
  boards: Whiteboard[]
  view: View
  /** 已造訪過的位置（最後一筆是上一頁）（#5） */
  history: NavEntry[]
  load: () => Promise<void>
  openLibrary: () => void
  /** 開啟一張卡片（會記進瀏覽記錄，可用上一頁回到標籤/白板）（#5） */
  openCard: (cardId: string) => void
  openBoard: (boardId: string) => void
  openJournal: () => void
  openTag: (tagId: string) => void
  openTrash: () => void
  openAccount: () => void
  /** 回到上一個位置；沒有記錄時回傳 false（#5） */
  back: () => boolean
  createBoard: (folderId?: string | null) => Promise<void>
  renameBoard: (id: string, name: string) => Promise<void>
  deleteBoard: (id: string) => Promise<void>
  /** 把白板搬進資料夾（null = 未分類）（#1） */
  moveBoardsToFolder: (ids: string[], folderId: string | null) => Promise<void>
}

const HISTORY_LIMIT = 50

// 與瀏覽器上一頁（含手機的返回手勢）連動（#5）：
// 每次切換畫面塞一筆瀏覽器記錄，使用者按上一頁時由 popstate 回呼 back()。
let pushedDepth = 0

function pushBrowserEntry(): void {
  if (typeof window === 'undefined') return
  pushedDepth += 1
  window.history.pushState({ notebookDepth: pushedDepth }, '')
}

/** 統一的「上一頁」：優先讓瀏覽器退，才能同時修正瀏覽器的前進/後退狀態 */
export function goBack(): void {
  if (pushedDepth > 0 && typeof window !== 'undefined') window.history.back()
  else useWhiteboardStore.getState().back()
}

/** App 收到 popstate 時呼叫 */
export function handlePopState(): void {
  pushedDepth = Math.max(0, pushedDepth - 1)
  useWhiteboardStore.getState().back()
}

/**
 * 產生「切到新畫面」要更新的狀態：把目前位置推進瀏覽記錄。
 * nextCardId 只在開卡片時給；其餘畫面沿用目前選取的卡片。
 */
function navigate(
  state: { view: View; history: NavEntry[] },
  view: View,
  nextCardId?: string,
): { view: View; history: NavEntry[] } {
  const current: NavEntry = { view: state.view, cardId: useCardStore.getState().selectedId }
  const target: NavEntry = { view, cardId: nextCardId ?? current.cardId }
  // 停在原地就不留記錄
  if (sameEntry(current, target)) return { view, history: state.history }
  pushBrowserEntry()
  return { view, history: [...state.history, current].slice(-HISTORY_LIMIT) }
}

/** 兩個位置是否指向同一個畫面（避免重複點同一項塞滿記錄） */
function sameEntry(a: NavEntry, b: NavEntry): boolean {
  if (a.cardId !== b.cardId || a.view.type !== b.view.type) return false
  if (a.view.type === 'board' && b.view.type === 'board') return a.view.boardId === b.view.boardId
  if (a.view.type === 'tag' && b.view.type === 'tag') return a.view.tagId === b.view.tagId
  return true
}

export const useWhiteboardStore = create<WhiteboardStore>((set, get) => ({
  boards: [],
  view: { type: 'library' },
  history: [],

  load: async () => {
    set({ boards: await whiteboardRepository.list() })
  },

  openLibrary: () => set(navigate(get(), { type: 'library' })),
  openCard: (cardId) => {
    const next = navigate(get(), { type: 'library' }, cardId)
    useCardStore.getState().select(cardId)
    set(next)
  },
  openBoard: (boardId) => set(navigate(get(), { type: 'board', boardId })),
  openJournal: () => set(navigate(get(), { type: 'journal' })),
  openTag: (tagId) => set(navigate(get(), { type: 'tag', tagId })),
  openTrash: () => set(navigate(get(), { type: 'trash' })),
  openAccount: () => set(navigate(get(), { type: 'account' })),

  back: () => {
    const { history } = get()
    const prev = history[history.length - 1]
    if (!prev) return false
    set({ view: prev.view, history: history.slice(0, -1) })
    useCardStore.getState().select(prev.cardId)
    return true
  },

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
