import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { CardEditor } from './components/CardEditor'
import { WhiteboardView } from './components/WhiteboardView'
import { JournalView } from './components/JournalView'
import { TagView } from './components/TagView'
import { TrashView } from './components/TrashView'
import { CommandPalette } from './components/CommandPalette'
import { useCardStore } from './store/useCardStore'
import { useWhiteboardStore } from './store/useWhiteboardStore'
import { useJournalStore } from './store/useJournalStore'
import { useTagStore } from './store/useTagStore'

export default function App() {
  const loadCards = useCardStore((s) => s.load)
  const cardsLoaded = useCardStore((s) => s.loaded)
  const cards = useCardStore((s) => s.cards)
  const selectedId = useCardStore((s) => s.selectedId)
  const loadBoards = useWhiteboardStore((s) => s.load)
  const loadJournal = useJournalStore((s) => s.load)
  const loadTags = useTagStore((s) => s.load)
  const view = useWhiteboardStore((s) => s.view)
  const selected = cards.find((c) => c.id === selectedId) ?? null
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    void loadCards()
    void loadBoards()
    void loadJournal()
    void loadTags()
  }, [loadCards, loadBoards, loadJournal, loadTags])

  // Cmd+K / Ctrl+K 快速開啟（features.md 模組 7，P0）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex h-screen bg-white text-gray-900">
      <Sidebar />
      <main className="min-w-0 flex-1">
        {view.type === 'board' ? (
          <WhiteboardView boardId={view.boardId} />
        ) : view.type === 'journal' ? (
          <JournalView />
        ) : view.type === 'tag' ? (
          <TagView tagId={view.tagId} />
        ) : view.type === 'trash' ? (
          <TrashView />
        ) : !cardsLoaded ? null : selected ? (
          <CardEditor key={selected.id} card={selected} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            從左側選一張卡片，或建立新卡片（Ctrl/⌘+K 快速搜尋）
          </div>
        )}
      </main>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  )
}
