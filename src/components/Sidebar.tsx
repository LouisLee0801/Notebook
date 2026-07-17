import { useCardStore } from '../store/useCardStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function Sidebar() {
  const cards = useCardStore((s) => s.cards)
  const selectedId = useCardStore((s) => s.selectedId)
  const selectCard = useCardStore((s) => s.select)
  const createCard = useCardStore((s) => s.createCard)
  const deleteCard = useCardStore((s) => s.deleteCard)

  const boards = useWhiteboardStore((s) => s.boards)
  const view = useWhiteboardStore((s) => s.view)
  const openLibrary = useWhiteboardStore((s) => s.openLibrary)
  const openBoard = useWhiteboardStore((s) => s.openBoard)
  const createBoard = useWhiteboardStore((s) => s.createBoard)
  const renameBoard = useWhiteboardStore((s) => s.renameBoard)
  const deleteBoard = useWhiteboardStore((s) => s.deleteBoard)

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
      <div className="border-b border-gray-200 px-4 py-3">
        <h1 className="text-sm font-bold text-gray-800">Notebook</h1>
      </div>

      {/* 白板列表 */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <h2 className="text-xs font-semibold tracking-wide text-gray-500">白板</h2>
        <button
          type="button"
          aria-label="新增白板"
          onClick={() => void createBoard()}
          className="rounded px-1.5 text-sm text-gray-500 hover:bg-gray-200"
        >
          ＋
        </button>
      </div>
      <ul className="max-h-56 overflow-y-auto px-2">
        {boards.length === 0 && (
          <li className="px-3 py-2 text-xs text-gray-400">還沒有白板</li>
        )}
        {boards.map((board) => (
          <li key={board.id} className="group relative">
            <button
              type="button"
              onClick={() => openBoard(board.id)}
              onDoubleClick={() => {
                const name = window.prompt('白板名稱', board.name)
                if (name?.trim()) void renameBoard(board.id, name.trim())
              }}
              className={`block w-full truncate rounded-md px-3 py-1.5 pr-7 text-left text-sm text-gray-800 hover:bg-gray-200 ${
                view.type === 'board' && view.boardId === board.id ? 'bg-gray-200 font-medium' : ''
              }`}
            >
              🗂 {board.name}
            </button>
            <button
              type="button"
              aria-label="刪除白板"
              onClick={() => {
                if (window.confirm(`要刪除白板「${board.name}」嗎？卡片會保留在卡片庫。`))
                  void deleteBoard(board.id)
              }}
              className="absolute top-1.5 right-1.5 hidden rounded px-1.5 text-xs text-gray-400 hover:bg-gray-300 hover:text-gray-700 group-hover:block"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {/* 卡片庫 */}
      <div className="mt-2 flex items-center justify-between border-t border-gray-200 px-4 pt-3 pb-1">
        <button
          type="button"
          onClick={openLibrary}
          className={`text-xs font-semibold tracking-wide hover:text-gray-800 ${
            view.type === 'library' ? 'text-gray-800' : 'text-gray-500'
          }`}
        >
          卡片庫
        </button>
        <button
          type="button"
          aria-label="新增卡片"
          onClick={() => {
            openLibrary()
            void createCard()
          }}
          className="rounded px-1.5 text-sm text-gray-500 hover:bg-gray-200"
        >
          ＋
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {cards.length === 0 && (
          <li className="px-3 py-8 text-center text-xs text-gray-400">
            還沒有卡片，點「＋」開始
          </li>
        )}
        {cards.map((card) => (
          <li key={card.id} className="group relative">
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-notebook-card', card.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => {
                selectCard(card.id)
                openLibrary()
              }}
              className={`block w-full cursor-grab rounded-md px-3 py-2 text-left hover:bg-gray-200 ${
                view.type === 'library' && card.id === selectedId ? 'bg-gray-200' : ''
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
      <p className="border-t border-gray-200 px-4 py-2 text-[11px] leading-relaxed text-gray-400">
        拖曳卡片到白板即可上板；白板上雙擊空白處新增卡片
      </p>
    </aside>
  )
}
