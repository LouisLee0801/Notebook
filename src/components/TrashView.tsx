import { useCallback, useEffect, useState } from 'react'
import type { Card } from '../types'
import { cardRepository } from '../db/cardRepository'
import { useCardStore } from '../store/useCardStore'

// 垃圾桶（features.md 模組 1，P1）：勾選批量還原/永久刪除，或一鍵清空（#6）
export function TrashView() {
  const [trashed, setTrashed] = useState<Card[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // 卡片列表變動（例如側邊欄刪卡）時同步刷新垃圾桶
  const cards = useCardStore((s) => s.cards)

  const refresh = useCallback(() => {
    void cardRepository.listTrashed().then((list) => {
      setTrashed(list)
      // 清掉已不在垃圾桶的勾選
      setSelected((prev) => new Set([...prev].filter((id) => list.some((c) => c.id === id))))
    })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, cards])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allSelected = trashed.length > 0 && selected.size === trashed.length
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(trashed.map((c) => c.id)))

  const restore = async (ids: string[]) => {
    for (const id of ids) await cardRepository.restore(id)
    await useCardStore.getState().load()
    await refresh()
  }

  const hardDelete = async (ids: string[], confirmMsg: string) => {
    if (!window.confirm(confirmMsg)) return
    for (const id of ids) await cardRepository.hardDelete(id)
    await useCardStore.getState().load()
    await refresh()
  }

  const emptyTrash = () =>
    hardDelete(
      trashed.map((c) => c.id),
      `要永久刪除垃圾桶內全部 ${trashed.length} 張卡片嗎？此動作無法復原。`,
    )

  const selectedIds = [...selected]

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">垃圾桶</h1>
          {trashed.length > 0 && (
            <button
              type="button"
              onClick={() => void emptyTrash()}
              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
            >
              🗑 清空垃圾桶
            </button>
          )}
        </div>

        {trashed.length === 0 && <p className="text-sm text-gray-400">垃圾桶是空的</p>}

        {trashed.length > 0 && (
          <div className="mb-3 flex items-center gap-3 border-b border-gray-100 pb-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              全選
            </label>
            <span className="text-xs text-gray-400">已勾選 {selected.size} 項</span>
            {selected.size > 0 && (
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => void restore(selectedIds)}
                  className="rounded-md border border-gray-200 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  還原勾選（{selected.size}）
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void hardDelete(
                      selectedIds,
                      `要永久刪除勾選的 ${selected.size} 張卡片嗎？此動作無法復原。`,
                    )
                  }
                  className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  刪除勾選（{selected.size}）
                </button>
              </div>
            )}
          </div>
        )}

        <ul className="space-y-2">
          {trashed.map((card) => (
            <li
              key={card.id}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                selected.has(card.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(card.id)}
                onChange={() => toggle(card.id)}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                {card.title || '未命名卡片'}
              </span>
              <button
                type="button"
                onClick={() => void restore([card.id])}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                還原
              </button>
              <button
                type="button"
                onClick={() =>
                  void hardDelete([card.id], '永久刪除後無法復原，確定嗎？')
                }
                className="rounded-md border border-gray-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50"
              >
                永久刪除
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
