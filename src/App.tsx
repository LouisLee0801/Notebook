import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { CardEditor } from './components/CardEditor'
import { WhiteboardView } from './components/WhiteboardView'
import { useCardStore } from './store/useCardStore'
import { useWhiteboardStore } from './store/useWhiteboardStore'

export default function App() {
  const loadCards = useCardStore((s) => s.load)
  const cardsLoaded = useCardStore((s) => s.loaded)
  const cards = useCardStore((s) => s.cards)
  const selectedId = useCardStore((s) => s.selectedId)
  const loadBoards = useWhiteboardStore((s) => s.load)
  const view = useWhiteboardStore((s) => s.view)
  const selected = cards.find((c) => c.id === selectedId) ?? null

  useEffect(() => {
    void loadCards()
    void loadBoards()
  }, [loadCards, loadBoards])

  return (
    <div className="flex h-screen bg-white text-gray-900">
      <Sidebar />
      <main className="min-w-0 flex-1">
        {view.type === 'board' ? (
          <WhiteboardView boardId={view.boardId} />
        ) : !cardsLoaded ? null : selected ? (
          <CardEditor key={selected.id} card={selected} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            從左側選一張卡片，或建立新卡片
          </div>
        )}
      </main>
    </div>
  )
}
