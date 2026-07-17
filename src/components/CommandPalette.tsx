import { useEffect, useMemo, useRef, useState } from 'react'
import { searchCards } from '../editor/text'
import { cardToMarkdown, downloadMarkdown } from '../editor/markdown'
import { useCardStore } from '../store/useCardStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import { useJournalStore } from '../store/useJournalStore'
import { todayString } from '../db/journalRepository'

interface PaletteItem {
  key: string
  kind: '卡片' | '白板' | '指令'
  title: string
  snippet?: string
  run: () => void
}

// 快速開啟 / 全文搜尋（features.md 模組 7，P0）：Cmd+K 開啟
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const cards = useCardStore((s) => s.cards)
  const boards = useWhiteboardStore((s) => s.boards)
  const journalCardIds = useJournalStore((s) => s.journalCardIds)

  useEffect(() => inputRef.current?.focus(), [])

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase()
    const openCard = (id: string) => {
      useCardStore.getState().select(id)
      useWhiteboardStore.getState().openLibrary()
    }

    const allCommands: PaletteItem[] = [
      {
        key: 'cmd-new-card',
        kind: '指令',
        title: '新增卡片',
        run: () => {
          useWhiteboardStore.getState().openLibrary()
          void useCardStore.getState().createCard()
        },
      },
      {
        key: 'cmd-new-board',
        kind: '指令',
        title: '新增白板',
        run: () => void useWhiteboardStore.getState().createBoard(),
      },
      {
        key: 'cmd-journal',
        kind: '指令',
        title: '開啟今日日誌',
        run: () => useWhiteboardStore.getState().openJournal(),
      },
      {
        key: 'cmd-export-all',
        kind: '指令',
        title: '匯出全部卡片（Markdown）',
        run: () => {
          const all = useCardStore.getState().cards
          const markdown = all.map((c) => cardToMarkdown(c)).join('\n\n---\n\n')
          downloadMarkdown(`notebook-export-${todayString()}.md`, markdown)
        },
      },
    ]
    const commands = allCommands.filter((c) => !q || c.title.toLowerCase().includes(q))

    const boardItems: PaletteItem[] = boards
      .filter((b) => !q || b.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((b) => ({
        key: `board-${b.id}`,
        kind: '白板',
        title: b.name,
        run: () => useWhiteboardStore.getState().openBoard(b.id),
      }))

    const cardItems: PaletteItem[] = q
      ? searchCards(cards, q, 12).map((r) => ({
          key: `card-${r.id}`,
          kind: '卡片',
          title: journalCardIds.has(r.id) ? `日誌 ${r.title}` : r.title || '未命名卡片',
          snippet: r.snippet,
          run: () => openCard(r.id),
        }))
      : cards.slice(0, 8).map((c) => ({
          key: `card-${c.id}`,
          kind: '卡片',
          title: journalCardIds.has(c.id) ? `日誌 ${c.title}` : c.title || '未命名卡片',
          run: () => openCard(c.id),
        }))

    return [...cardItems, ...boardItems, ...commands]
  }, [query, cards, boards, journalCardIds])

  const runItem = (item: PaletteItem | undefined) => {
    if (!item) return
    item.run()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((i) => Math.min(i + 1, items.length - 1))
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => Math.max(i - 1, 0))
            }
            if (e.key === 'Enter') runItem(items[index])
          }}
          placeholder="搜尋卡片、白板，或執行指令…"
          className="w-full border-b border-gray-100 bg-transparent px-4 py-3 text-sm outline-none"
        />
        <ul className="max-h-80 overflow-y-auto p-1">
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-gray-400">沒有符合的結果</li>
          )}
          {items.map((item, i) => (
            <li key={item.key}>
              <button
                type="button"
                onMouseEnter={() => setIndex(i)}
                onClick={() => runItem(item)}
                className={`flex w-full items-baseline gap-2 rounded-md px-3 py-2 text-left ${
                  i === index ? 'bg-gray-100' : ''
                }`}
              >
                <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                  {item.kind}
                </span>
                <span className="truncate text-sm text-gray-800">{item.title}</span>
                {item.snippet && (
                  <span className="min-w-0 flex-1 truncate text-xs text-gray-400">
                    {item.snippet}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
          ↑↓ 選擇．Enter 開啟．Esc 關閉
        </p>
      </div>
    </div>
  )
}
