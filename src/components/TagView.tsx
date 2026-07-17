import { useMemo, useState } from 'react'
import type { Card, TagProperty } from '../types'
import { useCardStore } from '../store/useCardStore'
import { useTagStore } from '../store/useTagStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import { PropertyCell } from './PropertyCell'

// 標籤即資料庫（features.md 模組 5，P1）：
// 自訂屬性 + 表格檢視（點欄位標題排序）+ 看板檢視（依單選屬性分欄，拖曳改值）

const PROPERTY_TYPES: { value: TagProperty['type']; label: string }[] = [
  { value: 'text', label: '文字' },
  { value: 'number', label: '數字' },
  { value: 'select', label: '單選' },
  { value: 'multiSelect', label: '多選' },
  { value: 'date', label: '日期' },
  { value: 'checkbox', label: '勾選' },
]

function openCard(id: string) {
  useCardStore.getState().select(id)
  useWhiteboardStore.getState().openLibrary()
}

function AddPropertyForm({ tagId }: { tagId: string }) {
  const addProperty = useTagStore((s) => s.addProperty)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<TagProperty['type']>('text')
  const [options, setOptions] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700"
      >
        ＋ 屬性
      </button>
    )
  }

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const needsOptions = type === 'select' || type === 'multiSelect'
    void addProperty(tagId, {
      id: crypto.randomUUID(),
      name: trimmed,
      type,
      ...(needsOptions
        ? { options: options.split(/[,，]/).map((o) => o.trim()).filter(Boolean) }
        : {}),
    })
    setName('')
    setOptions('')
    setType('text')
    setOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="屬性名稱"
        className="w-28 rounded border border-gray-200 px-2 py-1 text-xs outline-none"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as TagProperty['type'])}
        aria-label="屬性型別"
        className="rounded border border-gray-200 px-1 py-1 text-xs"
      >
        {PROPERTY_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      {(type === 'select' || type === 'multiSelect') && (
        <input
          value={options}
          onChange={(e) => setOptions(e.target.value)}
          placeholder="選項（逗號分隔）"
          className="w-40 rounded border border-gray-200 px-2 py-1 text-xs outline-none"
        />
      )}
      <button
        type="button"
        onClick={submit}
        className="rounded-md bg-gray-900 px-2 py-1 text-xs text-white hover:bg-gray-700"
      >
        新增
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="px-1 text-xs text-gray-400 hover:text-gray-600"
      >
        取消
      </button>
    </div>
  )
}

export function TagView({ tagId }: { tagId: string }) {
  const tag = useTagStore((s) => s.tags.find((t) => t.id === tagId))
  const cardTags = useTagStore((s) => s.cardTags)
  const renameTag = useTagStore((s) => s.renameTag)
  const deleteTag = useTagStore((s) => s.deleteTag)
  const removeProperty = useTagStore((s) => s.removeProperty)
  const setValue = useTagStore((s) => s.setValue)
  const cards = useCardStore((s) => s.cards)

  const [mode, setMode] = useState<'table' | 'kanban'>('table')
  const [sortKey, setSortKey] = useState<string>('updated') // 'updated' | 'title' | propertyId
  const [sortAsc, setSortAsc] = useState(false)
  const [kanbanPropId, setKanbanPropId] = useState<string | null>(null)

  const rows = useMemo(() => {
    if (!tag) return []
    const mine = cardTags.filter((ct) => ct.tagId === tagId)
    const list = mine
      .map((ct) => ({ card: cards.find((c) => c.id === ct.cardId), values: ct.values }))
      .filter((r): r is { card: Card; values: Record<string, unknown> } => Boolean(r.card))
    const dir = sortAsc ? 1 : -1
    const keyOf = (r: { card: Card; values: Record<string, unknown> }): string | number => {
      if (sortKey === 'updated') return r.card.updatedAt
      if (sortKey === 'title') return r.card.title
      const v = r.values[sortKey]
      if (typeof v === 'number' || typeof v === 'string') return v
      if (typeof v === 'boolean') return v ? 1 : 0
      if (Array.isArray(v)) return v.join(',')
      return ''
    }
    return list.sort((a, b) => {
      const ka = keyOf(a)
      const kb = keyOf(b)
      if (typeof ka === 'number' && typeof kb === 'number') return (ka - kb) * dir
      return String(ka).localeCompare(String(kb), 'zh-Hant') * dir
    })
  }, [tag, tagId, cardTags, cards, sortKey, sortAsc])

  if (!tag) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        找不到這個標籤
      </div>
    )
  }

  const selectProps = tag.properties.filter((p) => p.type === 'select')
  const kanbanProp =
    selectProps.find((p) => p.id === kanbanPropId) ?? selectProps[0] ?? null

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const sortMark = (key: string) => (sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : '')

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-8 py-10">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900"># {tag.name}</h1>
          <button
            type="button"
            onClick={() => {
              const name = window.prompt('標籤名稱', tag.name)
              if (name?.trim()) void renameTag(tag.id, name.trim())
            }}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
          >
            重新命名
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`要刪除標籤「${tag.name}」嗎？卡片不會被刪除。`))
                void deleteTag(tag.id)
            }}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50"
          >
            刪除標籤
          </button>
          <span className="text-sm text-gray-400">{rows.length} 張卡片</span>
          <div className="ml-auto flex items-center gap-1 rounded-md border border-gray-200 p-0.5">
            {(['table', 'kanban'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded px-2 py-0.5 text-xs ${
                  mode === m ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {m === 'table' ? '表格' : '看板'}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <AddPropertyForm tagId={tag.id} />
        </div>

        {mode === 'table' ? (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2">
                    <button type="button" onClick={() => toggleSort('title')}>
                      標題{sortMark('title')}
                    </button>
                  </th>
                  {tag.properties.map((p) => (
                    <th key={p.id} className="group px-3 py-2">
                      <button type="button" onClick={() => toggleSort(p.id)}>
                        {p.name}
                        {sortMark(p.id)}
                      </button>
                      <button
                        type="button"
                        aria-label={`刪除屬性 ${p.name}`}
                        onClick={() => {
                          if (window.confirm(`刪除屬性「${p.name}」？所有卡片上的值會清除。`))
                            void removeProperty(tag.id, p.id)
                        }}
                        className="ml-1 hidden text-gray-300 group-hover:inline hover:text-red-500"
                      >
                        ✕
                      </button>
                    </th>
                  ))}
                  <th className="px-3 py-2">
                    <button type="button" onClick={() => toggleSort('updated')}>
                      更新{sortMark('updated')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ card, values }) => (
                  <tr key={card.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => openCard(card.id)}
                        className="font-medium text-gray-800 hover:underline"
                      >
                        {card.title || '未命名卡片'}
                      </button>
                    </td>
                    {tag.properties.map((p) => (
                      <td key={p.id} className="px-3 py-1.5">
                        <PropertyCell
                          cardId={card.id}
                          tagId={tag.id}
                          property={p}
                          value={values[p.id]}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-xs text-gray-400">
                      {new Date(card.updatedAt).toLocaleDateString('zh-TW')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : kanbanProp ? (
          <div>
            {selectProps.length > 1 && (
              <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
                分欄依據：
                <select
                  value={kanbanProp.id}
                  onChange={(e) => setKanbanPropId(e.target.value)}
                  className="rounded border border-gray-200 px-1 py-0.5"
                >
                  {selectProps.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-3 overflow-x-auto pb-4">
              {['', ...(kanbanProp.options ?? [])].map((option) => {
                const columnCards = rows.filter(({ values }) =>
                  option === ''
                    ? !values[kanbanProp.id]
                    : values[kanbanProp.id] === option,
                )
                return (
                  <div
                    key={option || '__none__'}
                    data-kanban-column={option || '未分類'}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const cardId = e.dataTransfer.getData('application/x-notebook-kanban')
                      if (cardId)
                        void setValue(cardId, tag.id, kanbanProp.id, option || null)
                    }}
                    className="w-56 shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-2"
                  >
                    <h3 className="mb-2 px-1 text-xs font-semibold text-gray-500">
                      {option || '未分類'}
                      <span className="ml-1 text-gray-400">{columnCards.length}</span>
                    </h3>
                    <ul className="space-y-1.5">
                      {columnCards.map(({ card }) => (
                        <li key={card.id}>
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) =>
                              e.dataTransfer.setData('application/x-notebook-kanban', card.id)
                            }
                            onClick={() => openCard(card.id)}
                            className="block w-full cursor-grab rounded-md border border-gray-200 bg-white px-2.5 py-2 text-left text-sm text-gray-800 shadow-sm hover:bg-gray-50"
                          >
                            {card.title || '未命名卡片'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-400">
            看板需要一個「單選」屬性作為分欄依據——先用「＋ 屬性」新增一個吧
          </p>
        )}
      </div>
    </div>
  )
}
