import { useState } from 'react'
import { useTagStore } from '../store/useTagStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'

// 卡片上的標籤列（features.md 模組 5，P0：加/移除標籤）
export function TagChips({ cardId }: { cardId: string }) {
  const tags = useTagStore((s) => s.tags)
  const cardTags = useTagStore((s) => s.cardTags)
  const addTagToCard = useTagStore((s) => s.addTagToCard)
  const removeTagFromCard = useTagStore((s) => s.removeTagFromCard)
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')

  const mine = cardTags
    .filter((ct) => ct.cardId === cardId)
    .map((ct) => tags.find((t) => t.id === ct.tagId))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))

  const submit = () => {
    const name = value.trim()
    if (name) void addTagToCard(cardId, name)
    setValue('')
    setAdding(false)
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {mine.map((tag) => (
        <span
          key={tag.id}
          className="group inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
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
            className="hidden text-emerald-400 group-hover:inline hover:text-emerald-700"
          >
            ✕
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          list="tag-suggestions"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') {
              setValue('')
              setAdding(false)
            }
          }}
          onBlur={submit}
          placeholder="標籤名稱"
          className="w-28 rounded-full border border-gray-200 px-2 py-0.5 text-xs outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600"
        >
          ＋ 標籤
        </button>
      )}
      <datalist id="tag-suggestions">
        {tags.map((t) => (
          <option key={t.id} value={t.name} />
        ))}
      </datalist>
    </div>
  )
}
