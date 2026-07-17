import { useCardStore } from '../store/useCardStore'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CardLibrary() {
  const cards = useCardStore((s) => s.cards)
  const selectedId = useCardStore((s) => s.selectedId)
  const select = useCardStore((s) => s.select)
  const createCard = useCardStore((s) => s.createCard)
  const deleteCard = useCardStore((s) => s.deleteCard)

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h1 className="text-sm font-semibold text-gray-700">卡片庫</h1>
        <button
          type="button"
          onClick={() => void createCard()}
          className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-700"
        >
          ＋ 新增卡片
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {cards.length === 0 && (
          <li className="px-3 py-8 text-center text-xs text-gray-400">
            還沒有卡片，點「新增卡片」開始
          </li>
        )}
        {cards.map((card) => (
          <li key={card.id} className="group relative">
            <button
              type="button"
              onClick={() => select(card.id)}
              className={`block w-full rounded-md px-3 py-2 text-left hover:bg-gray-200 ${
                card.id === selectedId ? 'bg-gray-200' : ''
              }`}
            >
              <span className="block truncate pr-6 text-sm font-medium text-gray-800">
                {card.title || '未命名卡片'}
              </span>
              <span className="block text-xs text-gray-400">{formatTime(card.updatedAt)}</span>
            </button>
            <button
              type="button"
              aria-label="刪除卡片"
              onClick={() => {
                if (window.confirm('要刪除這張卡片嗎？（會移到垃圾桶）')) void deleteCard(card.id)
              }}
              className="absolute top-2 right-2 hidden rounded px-1.5 text-xs text-gray-400 hover:bg-gray-300 hover:text-gray-700 group-hover:block"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
