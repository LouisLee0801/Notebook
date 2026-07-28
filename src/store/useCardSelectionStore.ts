import { create } from 'zustand'

// 卡片庫多選（#8）：Ctrl/⌘ 點選累加、批量拖到資料夾、Delete 批量刪除
interface CardSelectionStore {
  selected: Set<string>
  toggle: (id: string) => void
  replace: (ids: string[]) => void
  clear: () => void
}

export const useCardSelectionStore = create<CardSelectionStore>((set) => ({
  selected: new Set(),
  toggle: (id) =>
    set((s) => {
      const next = new Set(s.selected)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selected: next }
    }),
  replace: (ids) => set({ selected: new Set(ids) }),
  clear: () => set((s) => (s.selected.size ? { selected: new Set() } : s)),
}))
