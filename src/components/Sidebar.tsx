import { useEffect, useState } from 'react'
import type { Card, Folder } from '../types'
import { useCardStore } from '../store/useCardStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import { useJournalStore } from '../store/useJournalStore'
import { useTagStore } from '../store/useTagStore'
import { useFolderStore } from '../store/useFolderStore'
import { useBoardNotesStore } from '../store/useBoardNotesStore'
import { useAuthStore } from '../store/useAuthStore'
import { syncConfigured } from '../sync/supabaseClient'
import { tagColor } from './tagColors'

const CARD_DND = 'application/x-notebook-card'

function AccountRow() {
  const session = useAuthStore((s) => s.session)
  const signOut = useAuthStore((s) => s.signOut)
  const unskip = useAuthStore((s) => s.unskip)

  return (
    <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-4 py-2">
      {session ? (
        <>
          <span className="min-w-0 truncate text-[11px] text-gray-500" title={session.user.email}>
            ☁️ {session.user.email}
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="shrink-0 text-[11px] text-gray-400 hover:text-gray-700"
          >
            登出
          </button>
        </>
      ) : (
        <>
          <span className="text-[11px] text-gray-400">尚未同步（離線模式）</span>
          <button
            type="button"
            onClick={unskip}
            className="shrink-0 text-[11px] text-blue-500 hover:text-blue-700"
          >
            登入同步
          </button>
        </>
      )}
    </div>
  )
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CardItem({ card }: { card: Card }) {
  const selectedId = useCardStore((s) => s.selectedId)
  const selectCard = useCardStore((s) => s.select)
  const deleteCard = useCardStore((s) => s.deleteCard)
  const view = useWhiteboardStore((s) => s.view)
  const openLibrary = useWhiteboardStore((s) => s.openLibrary)

  return (
    <li className="group relative">
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(CARD_DND, card.id)
          e.dataTransfer.effectAllowed = 'copyMove'
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
  )
}

// 可拖入卡片的容器：拖曳卡片放進來會設定其 folderId
function DropZone({
  folderId,
  className = '',
  children,
}: {
  folderId: string | null
  className?: string
  children: React.ReactNode
}) {
  const [over, setOver] = useState(false)
  const moveCardToFolder = useCardStore((s) => s.moveCardToFolder)

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(CARD_DND)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setOver(true)
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(CARD_DND)
        setOver(false)
        if (id) {
          e.preventDefault()
          void moveCardToFolder(id, folderId)
        }
      }}
      className={`${className} ${over ? 'rounded-md bg-blue-50 ring-1 ring-blue-300' : ''}`}
    >
      {children}
    </div>
  )
}

function FolderGroup({ folder, cards }: { folder: Folder; cards: Card[] }) {
  const [open, setOpen] = useState(true)
  const renameFolder = useFolderStore((s) => s.renameFolder)
  const deleteFolder = useFolderStore((s) => s.deleteFolder)
  const createCard = useCardStore((s) => s.createCard)
  const openLibrary = useWhiteboardStore((s) => s.openLibrary)

  return (
    <DropZone folderId={folder.id} className="mb-0.5">
      <div className="group flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-gray-100">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm text-gray-700"
        >
          <span className="w-3 shrink-0 text-xs text-gray-400">{open ? '▾' : '▸'}</span>
          <span>📁</span>
          <span className="truncate">{folder.name}</span>
          <span className="text-xs text-gray-400">{cards.length}</span>
        </button>
        <button
          type="button"
          aria-label={`在 ${folder.name} 新增卡片`}
          onClick={() => {
            openLibrary()
            void createCard(folder.id)
          }}
          className="hidden shrink-0 rounded px-1 text-xs text-gray-400 hover:bg-gray-200 hover:text-gray-700 group-hover:block"
        >
          ＋
        </button>
        <button
          type="button"
          aria-label={`重新命名資料夾 ${folder.name}`}
          onClick={() => {
            const name = window.prompt('資料夾名稱', folder.name)
            if (name?.trim()) void renameFolder(folder.id, name.trim())
          }}
          className="hidden shrink-0 rounded px-1 text-xs text-gray-400 hover:bg-gray-200 hover:text-gray-700 group-hover:block"
        >
          ✎
        </button>
        <button
          type="button"
          aria-label={`刪除資料夾 ${folder.name}`}
          onClick={() => {
            if (window.confirm(`刪除資料夾「${folder.name}」？裡面的卡片會移到未分類。`))
              void deleteFolder(folder.id)
          }}
          className="hidden shrink-0 rounded px-1 text-xs text-gray-400 hover:bg-gray-200 hover:text-red-500 group-hover:block"
        >
          ✕
        </button>
      </div>
      {open && (
        <ul className="ml-3 border-l border-gray-200 pl-1">
          {cards.length === 0 && (
            <li className="px-2 py-1 text-[11px] text-gray-300">拖曳卡片到這裡</li>
          )}
          {cards.map((card) => (
            <CardItem key={card.id} card={card} />
          ))}
        </ul>
      )}
    </DropZone>
  )
}

export function Sidebar() {
  const allCards = useCardStore((s) => s.cards)
  const journalCardIds = useJournalStore((s) => s.journalCardIds)
  // 日誌卡片不佔卡片庫列表（它們住在日誌時間軸裡）
  const cards = allCards.filter((c) => !journalCardIds.has(c.id))
  const createCard = useCardStore((s) => s.createCard)

  const folders = useFolderStore((s) => s.folders)
  const createFolder = useFolderStore((s) => s.createFolder)

  const notes = useBoardNotesStore((s) => s.notes)
  const loadNotes = useBoardNotesStore((s) => s.load)

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

  // 切換檢視時刷新便利貼總表（離開白板後即反映最新編輯）
  useEffect(() => {
    void loadNotes()
  }, [view, loadNotes])

  const unfiled = cards.filter((c) => !c.folderId)
  const cardsOf = (folderId: string) => cards.filter((c) => c.folderId === folderId)

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
      <ul className="max-h-48 overflow-y-auto px-2">
        {boards.length === 0 && <li className="px-3 py-2 text-xs text-gray-400">還沒有白板</li>}
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

      {/* 便利貼總表（#2）：跨白板列出，點擊開啟所在白板 */}
      {notes.length > 0 && (
        <>
          <div className="flex items-center justify-between border-t border-gray-200 px-4 pt-3 pb-1">
            <h2 className="text-xs font-semibold tracking-wide text-gray-500">便利貼</h2>
          </div>
          <ul className="max-h-32 overflow-y-auto px-2">
            {notes.map((note) => {
              const board = boards.find((b) => b.id === note.whiteboardId)
              const preview = note.text.trim().split('\n')[0] || '（空白便利貼）'
              return (
                <li key={note.id}>
                  <button
                    type="button"
                    onClick={() => openBoard(note.whiteboardId)}
                    className="block w-full rounded-md px-3 py-1 text-left hover:bg-gray-200"
                  >
                    <span className="block truncate text-sm text-gray-700">📝 {preview}</span>
                    {board && (
                      <span className="block truncate text-[11px] text-gray-400">{board.name}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {/* 標籤 */}
      {tags.length > 0 && (
        <>
          <div className="flex items-center justify-between border-t border-gray-200 px-4 pt-3 pb-1">
            <h2 className="text-xs font-semibold tracking-wide text-gray-500">標籤</h2>
          </div>
          <ul className="max-h-28 overflow-y-auto px-2">
            {tags.map((tag) => (
              <li key={tag.id}>
                <button
                  type="button"
                  onClick={() => openTag(tag.id)}
                  className={`flex w-full items-center gap-1.5 truncate rounded-md px-3 py-1 text-left text-sm text-gray-700 hover:bg-gray-200 ${
                    view.type === 'tag' && view.tagId === tag.id ? 'bg-gray-200 font-medium' : ''
                  }`}
                >
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: tagColor(tag.color).dot }}
                  />
                  <span className="truncate">{tag.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* 卡片庫（含資料夾）*/}
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
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="新增資料夾"
            title="新增資料夾"
            onClick={() => {
              const name = window.prompt('資料夾名稱')
              if (name?.trim()) void createFolder(name.trim())
            }}
            className="rounded px-1.5 text-sm text-gray-500 hover:bg-gray-200"
          >
            📁
          </button>
          <button
            type="button"
            aria-label="新增卡片"
            title="新增卡片"
            onClick={() => {
              openLibrary()
              void createCard()
            }}
            className="rounded px-1.5 text-sm text-gray-500 hover:bg-gray-200"
          >
            ＋
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {cards.length === 0 && folders.length === 0 && (
          <p className="px-3 py-8 text-center text-xs text-gray-400">還沒有卡片，點「＋」開始</p>
        )}
        {folders.map((folder) => (
          <FolderGroup key={folder.id} folder={folder} cards={cardsOf(folder.id)} />
        ))}
        {/* 未分類卡片：也是一個放置區（把卡片拖出資料夾）*/}
        <DropZone folderId={null} className="mt-1">
          {folders.length > 0 && unfiled.length > 0 && (
            <div className="px-1.5 py-1 text-[11px] font-semibold tracking-wide text-gray-400">
              未分類
            </div>
          )}
          <ul>
            {unfiled.map((card) => (
              <CardItem key={card.id} card={card} />
            ))}
          </ul>
        </DropZone>
      </div>

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
      {syncConfigured && <AccountRow />}
      <p className="border-t border-gray-200 px-4 py-2 text-[11px] leading-relaxed text-gray-400">
        拖卡片到資料夾可分類；拖到白板可上板
      </p>
    </aside>
  )
}
