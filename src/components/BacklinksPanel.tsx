import { useEffect, useState } from 'react'
import type { Card } from '../types'
import { cardRepository } from '../db/cardRepository'
import { findLinkContext, linkRepository } from '../db/linkRepository'
import { useCardStore } from '../store/useCardStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import { useJournalStore } from '../store/useJournalStore'

interface BacklinkItem {
  card: Card
  snippet: string
}

// 反向連結面板（features.md 模組 4，P0）：哪些卡片連到我，含上下文預覽
export function BacklinksPanel({ cardId }: { cardId: string }) {
  const [items, setItems] = useState<BacklinkItem[]>([])
  const cards = useCardStore((s) => s.cards)
  const journalCardIds = useJournalStore((s) => s.journalCardIds)

  useEffect(() => {
    let live = true
    void (async () => {
      const links = await linkRepository.backlinks(cardId)
      const results: BacklinkItem[] = []
      for (const link of links) {
        const from = await cardRepository.get(link.fromCardId)
        if (!from || from.deletedAt !== null) continue
        results.push({ card: from, snippet: findLinkContext(from.content, cardId) })
      }
      if (live) setItems(results)
    })()
    return () => {
      live = false
    }
    // cards 變動（含標題/內容更新）時重新整理面板
  }, [cardId, cards])

  if (items.length === 0) return null

  return (
    <section className="mt-10 border-t border-gray-200 pt-4">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-gray-500">
        反向連結（{items.length}）
      </h3>
      <ul className="space-y-1">
        {items.map(({ card, snippet }) => (
          <li key={card.id}>
            <button
              type="button"
              onClick={() => {
                useCardStore.getState().select(card.id)
                useWhiteboardStore.getState().openLibrary()
              }}
              className="block w-full rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-left hover:bg-gray-100"
            >
              <span className="block truncate text-sm font-medium text-gray-800">
                {journalCardIds.has(card.id) ? `📅 日誌 ${card.title}` : card.title || '未命名卡片'}
              </span>
              {snippet && (
                <span className="mt-0.5 block truncate text-xs text-gray-500">{snippet}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
