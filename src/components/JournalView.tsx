import { useEffect } from 'react'
import { useCardStore } from '../store/useCardStore'
import { useJournalStore } from '../store/useJournalStore'
import { todayString } from '../db/journalRepository'
import { CardEditor } from './CardEditor'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`
}

// 日誌（features.md 模組 6，P0）：每日一頁、時間軸捲動、開啟直達今日
export function JournalView() {
  const entries = useJournalStore((s) => s.entries)
  const ensureToday = useJournalStore((s) => s.ensureToday)
  const cards = useCardStore((s) => s.cards)
  const today = todayString()

  useEffect(() => {
    void ensureToday()
  }, [ensureToday])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">日誌</h1>
        {entries.map((entry) => {
          const card = cards.find((c) => c.id === entry.cardId)
          if (!card) return null
          return (
            <section key={entry.date} className="mb-10">
              <h2 className="mb-1 flex items-baseline gap-2 border-b border-gray-100 pb-2 text-lg font-semibold text-gray-800">
                {formatDate(entry.date)}
                {entry.date === today && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                    今天
                  </span>
                )}
              </h2>
              <CardEditor key={card.id} card={card} compact hideTitle />
            </section>
          )
        })}
      </div>
    </div>
  )
}
