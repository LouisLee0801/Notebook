import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { CardEditor } from './components/CardEditor'
import { WhiteboardView } from './components/WhiteboardView'
import { JournalView } from './components/JournalView'
import { TagView } from './components/TagView'
import { TrashView } from './components/TrashView'
import { CommandPalette } from './components/CommandPalette'
import { LoginView } from './components/LoginView'
import { syncConfigured } from './sync/supabaseClient'
import { useAuthStore } from './store/useAuthStore'
import { useCardStore } from './store/useCardStore'
import { useWhiteboardStore } from './store/useWhiteboardStore'
import { useJournalStore } from './store/useJournalStore'
import { useTagStore } from './store/useTagStore'
import { useFolderStore } from './store/useFolderStore'

export default function App() {
  const loadCards = useCardStore((s) => s.load)
  const cardsLoaded = useCardStore((s) => s.loaded)
  const cards = useCardStore((s) => s.cards)
  const selectedId = useCardStore((s) => s.selectedId)
  const loadBoards = useWhiteboardStore((s) => s.load)
  const loadJournal = useJournalStore((s) => s.load)
  const loadTags = useTagStore((s) => s.load)
  const loadFolders = useFolderStore((s) => s.load)
  const view = useWhiteboardStore((s) => s.view)
  const selected = cards.find((c) => c.id === selectedId) ?? null
  const [paletteOpen, setPaletteOpen] = useState(false)

  const authReady = useAuthStore((s) => s.ready)
  const session = useAuthStore((s) => s.session)
  const skipped = useAuthStore((s) => s.skipped)
  const initAuth = useAuthStore((s) => s.init)

  useEffect(() => {
    initAuth()
  }, [initAuth])

  useEffect(() => {
    void loadCards()
    void loadBoards()
    void loadJournal()
    void loadTags()
    void loadFolders()
  }, [loadCards, loadBoards, loadJournal, loadTags, loadFolders])

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

  if (syncConfigured && !authReady) return null
  if (syncConfigured && !session && !skipped) return <LoginView />

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
