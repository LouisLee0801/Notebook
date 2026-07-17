import { useState } from 'react'
import type { TagProperty } from '../types'
import { useTagStore } from '../store/useTagStore'

// 表格檢視的單一儲存格：依屬性型別提供對應編輯器
export function PropertyCell({
  cardId,
  tagId,
  property,
  value,
}: {
  cardId: string
  tagId: string
  property: TagProperty
  value: unknown
}) {
  const setValue = useTagStore((s) => s.setValue)
  const [draft, setDraft] = useState<string | null>(null)

  const save = (v: unknown) => void setValue(cardId, tagId, property.id, v)

  switch (property.type) {
    case 'checkbox':
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => save(e.target.checked)}
          aria-label={property.name}
        />
      )
    case 'select':
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => save(e.target.value)}
          aria-label={property.name}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-gray-200"
        >
          <option value="">—</option>
          {(property.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )
    case 'multiSelect': {
      const selected = Array.isArray(value) ? (value as string[]) : []
      return (
        <div className="flex flex-wrap items-center gap-1">
          {selected.map((opt) => (
            <button
              key={opt}
              type="button"
              title="點擊移除"
              onClick={() => save(selected.filter((o) => o !== opt))}
              className="rounded-full bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 hover:bg-blue-100"
            >
              {opt} ✕
            </button>
          ))}
          <select
            value=""
            onChange={(e) => {
              if (e.target.value && !selected.includes(e.target.value))
                save([...selected, e.target.value])
            }}
            aria-label={`新增${property.name}`}
            className="rounded border border-transparent bg-transparent py-0.5 text-xs text-gray-400 hover:border-gray-200"
          >
            <option value="">＋</option>
            {(property.options ?? [])
              .filter((opt) => !selected.includes(opt))
              .map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
          </select>
        </div>
      )
    }
    case 'date':
      return (
        <input
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => save(e.target.value)}
          aria-label={property.name}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-gray-200"
        />
      )
    case 'number':
      return (
        <input
          type="number"
          value={draft ?? (typeof value === 'number' ? String(value) : '')}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null) save(draft === '' ? null : Number(draft))
            setDraft(null)
          }}
          aria-label={property.name}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-gray-200"
        />
      )
    default:
      return (
        <input
          type="text"
          value={draft ?? (typeof value === 'string' ? value : '')}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null) save(draft)
            setDraft(null)
          }}
          aria-label={property.name}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-gray-200"
        />
      )
  }
}
