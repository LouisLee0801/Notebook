import { create } from 'zustand'

// 白板操作的「上一步 / 重做」（#4）
//
// 每個會改動白板的操作都往 past 推一筆，內含把畫面與資料庫還原回去的 undo，
// 以及重新套用一次的 redo。歷史只存在記憶體，切換白板即重置
// （跨裝置同步的是結果，不是操作序列）。
export interface HistoryEntry {
  label: string
  undo: () => void | Promise<void>
  redo: () => void | Promise<void>
}

const LIMIT = 100

interface BoardHistoryStore {
  past: HistoryEntry[]
  future: HistoryEntry[]
  /** 正在執行 undo/redo：期間產生的變更不再記進歷史 */
  applying: boolean
  push: (entry: HistoryEntry) => void
  undo: () => Promise<string | null>
  redo: () => Promise<string | null>
  reset: () => void
}

export const useBoardHistoryStore = create<BoardHistoryStore>((set, get) => ({
  past: [],
  future: [],
  applying: false,

  push: (entry) => {
    if (get().applying) return
    // 有新操作就清掉重做鏈
    set({ past: [...get().past, entry].slice(-LIMIT), future: [] })
  },

  undo: async () => {
    const { past, future } = get()
    const entry = past[past.length - 1]
    if (!entry) return null
    set({ applying: true, past: past.slice(0, -1), future: [...future, entry] })
    try {
      await entry.undo()
    } finally {
      set({ applying: false })
    }
    return entry.label
  },

  redo: async () => {
    const { past, future } = get()
    const entry = future[future.length - 1]
    if (!entry) return null
    set({ applying: true, future: future.slice(0, -1), past: [...past, entry] })
    try {
      await entry.redo()
    } finally {
      set({ applying: false })
    }
    return entry.label
  },

  reset: () => set({ past: [], future: [], applying: false }),
}))
