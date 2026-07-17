import { useCardStore } from '../store/useCardStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import { useJournalStore } from '../store/useJournalStore'
import { useTagStore } from '../store/useTagStore'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function Sidebar() {
  const allCards = useCardStore((s) => s.cards)
  const journalCardIds = useJournalStore((s) => s.journalCardIds)
  // 日誌卡片不佔卡片庫列表（它們住在日誌時間軸裡）
  const cards = allCards.filter((c) => !journalCardIds.has(c.id))
  const selectedId = useCardStore((s) => s.selectedId)
  const selectCard = useCardStore((s) => s.select)
  const createCard = useCardStore((s) => s.createCard)
  const deleteCard = useCardStore((s) => s.deleteCard)

  const boards = useWhiteboardStore((s) => s.boards)
  const view = useWhiteboardStore((s) => s.view)
  const openLibrary = useWhiteboardStore((s) => s.openLibrary)
  const openBoard = useWhiteboardStore((s) => s.openBoard)
  const openJournal = useWhiteboardStore((s) => s.openJournal)
  const openTag = useWhiteboardStore((s) => s.openTag)
  const openTrash = useWhiteboardStore((s) => s.openTrash)
  const tags = useTagStore((s) => s.tags)
  const createBoard = useWhiteboardStore((s) => s.createBoard)
  const renameBoard = useWhiteboardStore((s) => s.renameBoard)
  const deleteBoard = useWhiteboardStore((s) => s.deleteBoard)

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
      <div className="border-b border-gray-200 px-4 py-3">
        <h1 className="text-sm font-bold text-gray-800">Notebook</h1>
      </div>

      {/* 日誌：開啟直達今日 */}
      <button
        type="button"
        onClick={openJournal}
        className={`mx-2 mt-2 rounded-md px-3 py-1.5 text-left text-sm hover:bg-gray-200 ${
          view.type === 'journal' ? 'bg-gray-200 font-medium text-gray-900' : 'text-gray-700'
        }`}
      >
        📅 日誌
      </button>

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

      {/* 標籤 */}
      {tags.length > 0 && (
        <>
          <div className="flex items-center justify-between border-t border-gray-200 px-4 pt-3 pb-1">
            <h2 className="text-xs font-semibold tracking-wide text-gray-500">標籤</h2>
          </div>
          <ul className="max-h-32 overflow-y-auto px-2">
            {tags.map((tag) => (
              <li key={tag.id}>
                <button
                  type="button"
                  onClick={() => openTag(tag.id)}
                  className={`block w-full truncate rounded-md px-3 py-1 text-left text-sm text-gray-700 hover:bg-gray-200 ${
                    view.type === 'tag' && view.tagId === tag.id ? 'bg-gray-200 font-medium' : ''
                  }`}
                >
                  # {tag.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

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
      <div className="flex items-center justify-between border-t border-gray-200 px-2 py-1.5">
        <button
          type="button"
          onClick={openTrash}
          className={`rounded-md px-2 py-1 text-xs hover:bg-gray-200 ${
            view.type === 'trash' ? 'bg-gray-200 text-gray-800' : 'text-gray-500'
          }`}
        >
          🗑 垃圾桶
        </button>
        <span className="px-2 text-[11px] text-gray-400">Ctrl/⌘+K 搜尋</span>
      </div>
      <p className="border-t border-gray-200 px-4 py-2 text-[11px] leading-relaxed text-gray-400">
        拖曳卡片到白板即可上板；白板上雙擊空白處新增卡片
      </p>
    </aside>
  )
}
