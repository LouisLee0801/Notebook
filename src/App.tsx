import { useEffect } from 'react'
import { CardLibrary } from './components/CardLibrary'
import { CardEditor } from './components/CardEditor'
import { useCardStore } from './store/useCardStore'

export default function App() {
  const load = useCardStore((s) => s.load)
  const loaded = useCardStore((s) => s.loaded)
  const cards = useCardStore((s) => s.cards)
  const selectedId = useCardStore((s) => s.selectedId)
  const selected = cards.find((c) => c.id === selectedId) ?? null

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex h-screen bg-white text-gray-900">
      <CardLibrary />
      <main className="min-w-0 flex-1">
        {!loaded ? null : selected ? (
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
