import { useEffect, useState } from 'react'
import { useCardStore } from '../store/useCardStore'
import { useJournalStore } from '../store/useJournalStore'
import { todayString } from '../db/journalRepository'
import { CardEditor } from './CardEditor'
import { JournalCalendar } from './JournalCalendar'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`
}

// 日誌（features.md 模組 6 + #5 Journey）：
// 頂部日期導覽（本週＋下週，可展開月曆）；畫面只顯示「選到的那一天」的日誌。
export function JournalView() {
  const entries = useJournalStore((s) => s.entries)
  const ensureToday = useJournalStore((s) => s.ensureToday)
  const ensureDate = useJournalStore((s) => s.ensureDate)
  const cards = useCardStore((s) => s.cards)
  const today = todayString()
  const [selected, setSelected] = useState(today)

  useEffect(() => {
    void ensureToday()
  }, [ensureToday])

  const pick = async (date: string) => {
    setSelected(date)
    await ensureDate(date)
  }

  const entryDates = new Set(entries.map((e) => e.date))
  const entry = entries.find((e) => e.date === selected)
  const card = entry ? cards.find((c) => c.id === entry.cardId) : undefined

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-8 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">日誌</h1>
        <div className="mb-6">
          <JournalCalendar selected={selected} entryDates={entryDates} onPick={(d) => void pick(d)} />
        </div>

        <section>
          <h2 className="mb-2 flex items-baseline gap-2 border-b border-gray-100 pb-2 text-lg font-semibold text-gray-800">
            {formatDate(selected)}
            {selected === today && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                今天
              </span>
            )}
          </h2>
          {card ? (
            <CardEditor key={card.id} card={card} compact hideTitle />
          ) : (
            <p className="py-6 text-sm text-gray-400">載入中…</p>
          )}
        </section>
      </div>
    </div>
  )
}
