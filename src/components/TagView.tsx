import { useCardStore } from '../store/useCardStore'
import { useTagStore } from '../store/useTagStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import { extractText } from '../editor/text'

// 標籤頁（features.md 模組 5）：列出掛此標籤的卡片（M5 再升級成資料庫檢視）
export function TagView({ tagId }: { tagId: string }) {
  const tag = useTagStore((s) => s.tags.find((t) => t.id === tagId))
  const cardTags = useTagStore((s) => s.cardTags)
  const renameTag = useTagStore((s) => s.renameTag)
  const deleteTag = useTagStore((s) => s.deleteTag)
  const cards = useCardStore((s) => s.cards)

  if (!tag) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        找不到這個標籤
      </div>
    )
  }

  const tagged = cardTags
    .filter((ct) => ct.tagId === tagId)
    .map((ct) => cards.find((c) => c.id === ct.cardId))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        <div className="mb-6 flex items-center gap-3">
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
          <span className="text-sm text-gray-400">{tagged.length} 張卡片</span>
        </div>
        <ul className="space-y-2">
          {tagged.map((card) => {
            const preview = extractText(card.content).replace(/\n/g, ' ').slice(0, 80)
            return (
              <li key={card.id}>
                <button
                  type="button"
                  onClick={() => {
                    useCardStore.getState().select(card.id)
                    useWhiteboardStore.getState().openLibrary()
                  }}
                  className="block w-full rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <span className="block text-sm font-medium text-gray-800">
                    {card.title || '未命名卡片'}
                  </span>
                  {preview && (
                    <span className="mt-0.5 block truncate text-xs text-gray-400">{preview}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
