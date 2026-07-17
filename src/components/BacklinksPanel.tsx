import { useEffect, useState } from 'react'
import type { Card } from '../types'
import { cardRepository } from '../db/cardRepository'
import { findLinkContext, linkRepository } from '../db/linkRepository'
import { convertMentionsToLinks, findUnlinkedMentions } from '../editor/mentions'
import { useCardStore } from '../store/useCardStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import { useJournalStore } from '../store/useJournalStore'

interface BacklinkItem {
  card: Card
  snippet: string
}

// 反向連結面板（features.md 模組 4，P0）：哪些卡片連到我，含上下文預覽；
// 加上未連結提及（P1）：內文出現本卡標題但未加連結的卡片，可一鍵轉為連結
export function BacklinksPanel({ cardId }: { cardId: string }) {
  const [items, setItems] = useState<BacklinkItem[]>([])
  const [mentions, setMentions] = useState<BacklinkItem[]>([])
  const cards = useCardStore((s) => s.cards)
  const updateCard = useCardStore((s) => s.updateCard)
  const journalCardIds = useJournalStore((s) => s.journalCardIds)
  const target = cards.find((c) => c.id === cardId)

  useEffect(() => {
    let live = true
    void (async () => {
      const links = await linkRepository.backlinks(cardId)
      const results: BacklinkItem[] = []
      const linkedFromIds = new Set<string>()
      for (const link of links) {
        const from = await cardRepository.get(link.fromCardId)
        if (!from || from.deletedAt !== null) continue
        linkedFromIds.add(from.id)
        results.push({ card: from, snippet: findLinkContext(from.content, cardId) })
      }
      if (!live) return
      setItems(results)
      const t = useCardStore.getState().cards.find((c) => c.id === cardId)
      setMentions(t ? findUnlinkedMentions(useCardStore.getState().cards, t, linkedFromIds) : [])
    })()
    return () => {
      live = false
    }
    // cards 變動（含標題/內容更新）時重新整理面板
  }, [cardId, cards])

  const convertMention = (from: Card) => {
    if (!target) return
    const { content, converted } = convertMentionsToLinks(from.content, target.title, target.id)
    if (converted > 0) void updateCard(from.id, { content })
  }

  if (items.length === 0 && mentions.length === 0) return null

  const displayName = (card: Card) =>
    journalCardIds.has(card.id) ? `📅 日誌 ${card.title}` : card.title || '未命名卡片'

  return (
    <section className="mt-10 border-t border-gray-200 pt-4">
      {items.length > 0 && (
        <>
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
                    {displayName(card)}
                  </span>
                  {snippet && (
                    <span className="mt-0.5 block truncate text-xs text-gray-500">{snippet}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {mentions.length > 0 && (
        <>
          <h3 className="mt-4 mb-2 text-xs font-semibold tracking-wide text-gray-500">
            未連結提及（{mentions.length}）
          </h3>
          <ul className="space-y-1">
            {mentions.map(({ card, snippet }) => (
              <li key={card.id} className="flex items-stretch gap-1">
                <button
                  type="button"
                  onClick={() => {
                    useCardStore.getState().select(card.id)
                    useWhiteboardStore.getState().openLibrary()
                  }}
                  className="block min-w-0 flex-1 rounded-md border border-dashed border-gray-200 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <span className="block truncate text-sm font-medium text-gray-800">
                    {displayName(card)}
                  </span>
                  {snippet && (
                    <span className="mt-0.5 block truncate text-xs text-gray-500">{snippet}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => convertMention(card)}
                  className="shrink-0 rounded-md border border-gray-200 px-2 text-xs text-blue-600 hover:bg-blue-50"
                >
                  轉為連結
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
