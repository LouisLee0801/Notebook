import { useCallback, useEffect, useState } from 'react'
import type { Card } from '../types'
import { cardRepository } from '../db/cardRepository'
import { useCardStore } from '../store/useCardStore'

// 垃圾桶（features.md 模組 1，P1）：還原或永久刪除
export function TrashView() {
  const [trashed, setTrashed] = useState<Card[]>([])
  // 卡片列表變動（例如側邊欄刪卡）時同步刷新垃圾桶
  const cards = useCardStore((s) => s.cards)

  const refresh = useCallback(() => {
    void cardRepository.listTrashed().then(setTrashed)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, cards])

  const restore = async (id: string) => {
    await cardRepository.restore(id)
    await useCardStore.getState().load()
    await refresh()
  }

  const hardDelete = async (id: string) => {
    if (!window.confirm('永久刪除後無法復原，確定嗎？')) return
    await cardRepository.hardDelete(id)
    await refresh()
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">垃圾桶</h1>
        {trashed.length === 0 && <p className="text-sm text-gray-400">垃圾桶是空的</p>}
        <ul className="space-y-2">
          {trashed.map((card) => (
            <li
              key={card.id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                {card.title || '未命名卡片'}
              </span>
              <button
                type="button"
                onClick={() => void restore(card.id)}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                還原
              </button>
              <button
                type="button"
                onClick={() => void hardDelete(card.id)}
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
