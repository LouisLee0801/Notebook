import { useEffect, useRef, useState } from 'react'
import { useTagStore } from '../store/useTagStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import { tagColor } from './tagColors'
import { matchTags, moveItem, tagsOfCard } from './cardTags'

const TAG_DND = 'application/x-notebook-tag-index' // 拖曳排序時攜帶來源索引

// 卡片上的標籤列（features.md 模組 5）
// #1 標籤可搜尋；#4 一次多選、拖曳調整順序

/** 多選面板：搜尋既有標籤、勾選加入/移除，也能直接建立新標籤 */
function TagPicker({ cardId, onClose }: { cardId: string; onClose: () => void }) {
  const tags = useTagStore((s) => s.tags)
  const cardTags = useTagStore((s) => s.cardTags)
  const addTagToCard = useTagStore((s) => s.addTagToCard)
  const removeTagFromCard = useTagStore((s) => s.removeTagFromCard)
  const [query, setQuery] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  const mineIds = new Set(tagsOfCard(cardId, cardTags, tags).map((t) => t.id))
  const results = matchTags(tags, query)
  const trimmed = query.trim()
  const canCreate = trimmed !== '' && !tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())

  // 點面板外面就關閉
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  return (
    <div ref={boxRef} className="tag-picker">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          // Enter：有輸入就建立新標籤（面板不關，可以接著加下一個）
          if (e.key === 'Enter' && canCreate) {
            void addTagToCard(cardId, trimmed)
            setQuery('')
          }
        }}
        placeholder="搜尋或新增標籤…"
        aria-label="搜尋標籤"
        className="tag-picker-search"
      />
      <div className="tag-picker-list">
        {results.length === 0 && !canCreate && (
          <p className="tag-picker-empty">找不到符合的標籤</p>
        )}
        {results.map((tag) => {
          const checked = mineIds.has(tag.id)
          const c = tagColor(tag.color)
          return (
            <button
              key={tag.id}
              type="button"
              // 多選：點一下切換，面板保持開啟可繼續選（#4）
              onClick={() =>
                checked
                  ? void removeTagFromCard(cardId, tag.id)
                  : void addTagToCard(cardId, tag.name)
              }
              className={`tag-picker-item${checked ? ' is-checked' : ''}`}
            >
              <span className="tag-picker-check">{checked ? '✓' : ''}</span>
              <span
                className="tag-picker-chip"
                style={{ background: c.chipBg, color: c.chipText }}
              >
                #{tag.name}
              </span>
            </button>
          )
        })}
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              void addTagToCard(cardId, trimmed)
              setQuery('')
            }}
            className="tag-picker-item is-create"
          >
            <span className="tag-picker-check">＋</span>
            <span>建立標籤「{trimmed}」</span>
          </button>
        )}
      </div>
      <p className="tag-picker-hint">點選可多選．Enter 建立新標籤．Esc 關閉</p>
    </div>
  )
}

export function TagChips({ cardId }: { cardId: string }) {
  const tags = useTagStore((s) => s.tags)
  const cardTags = useTagStore((s) => s.cardTags)
  const removeTagFromCard = useTagStore((s) => s.removeTagFromCard)
  const reorderCardTags = useTagStore((s) => s.reorderCardTags)
  const [picking, setPicking] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const mine = tagsOfCard(cardId, cardTags, tags)

  const drop = (from: number, to: number) => {
    setDragIndex(null)
    setOverIndex(null)
    if (from < 0) return
    const next = moveItem(mine, from, to)
    if (next !== mine) void reorderCardTags(cardId, next.map((t) => t.id))
  }

  return (
    <div className="relative mt-2 flex flex-wrap items-center gap-1.5">
      {mine.map((tag, i) => {
        const c = tagColor(tag.color)
        return (
          <span
            key={tag.id}
            // #4 拖曳調整標籤順序
            draggable
            onDragStart={(e) => {
              // 來源索引放進 dataTransfer：不依賴 React state 是否已更新，拖再快也不會抓錯
              e.dataTransfer.setData(TAG_DND, String(i))
              e.dataTransfer.effectAllowed = 'move'
              setDragIndex(i)
            }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(TAG_DND)) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setOverIndex(i)
            }}
            onDrop={(e) => {
              const raw = e.dataTransfer.getData(TAG_DND)
              if (raw === '') return
              e.preventDefault()
              drop(Number(raw), i)
            }}
            onDragEnd={() => {
              setDragIndex(null)
              setOverIndex(null)
            }}
            title="拖曳可調整順序"
            className={`group inline-flex cursor-grab items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
              overIndex === i && dragIndex !== i ? 'ring-2 ring-blue-400' : ''
            } ${dragIndex === i ? 'opacity-40' : ''}`}
            style={{ background: c.chipBg, color: c.chipText }}
          >
            <button
              type="button"
              onClick={() => useWhiteboardStore.getState().openTag(tag.id)}
              className="hover:underline"
            >
              #{tag.name}
            </button>
            <button
              type="button"
              aria-label={`移除標籤 ${tag.name}`}
              onClick={() => void removeTagFromCard(cardId, tag.id)}
              className="hidden opacity-60 group-hover:inline hover:opacity-100"
            >
              ✕
            </button>
          </span>
        )
      })}
      <button
        type="button"
        aria-label="加入標籤"
        onClick={() => setPicking((v) => !v)}
        className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600"
      >
        ＋ 標籤
      </button>
      {picking && <TagPicker cardId={cardId} onClose={() => setPicking(false)} />}
    </div>
  )
}
