import { useEffect, useRef, useState } from 'react'
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

// 日誌（features.md 模組 6，P0 + #5 Journey）：
// 頂部日期導覽（本週＋下週，可展開月曆）；點日期可編輯該天；時間軸捲動。
export function JournalView() {
  const entries = useJournalStore((s) => s.entries)
  const ensureToday = useJournalStore((s) => s.ensureToday)
  const ensureDate = useJournalStore((s) => s.ensureDate)
  const cards = useCardStore((s) => s.cards)
  const today = todayString()
  const [selected, setSelected] = useState(today)
  const [pendingScroll, setPendingScroll] = useState<string | null>(today)
  const sectionRefs = useRef(new Map<string, HTMLElement>())

  useEffect(() => {
    void ensureToday()
  }, [ensureToday])

  // 選定日期建立/存在後，捲動到該天並短暫高亮
  useEffect(() => {
    if (!pendingScroll) return
    const el = sectionRefs.current.get(pendingScroll)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.classList.add('journal-flash')
      const t = setTimeout(() => el.classList.remove('journal-flash'), 1200)
      setPendingScroll(null)
      return () => clearTimeout(t)
    }
  }, [pendingScroll, entries])

  const pick = async (date: string) => {
    setSelected(date)
    await ensureDate(date)
    setPendingScroll(date)
  }

  const entryDates = new Set(entries.map((e) => e.date))

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-8 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">日誌</h1>
        <div className="sticky top-0 z-10 -mx-1 mb-6 bg-white/80 px-1 pb-2 backdrop-blur">
          <JournalCalendar selected={selected} entryDates={entryDates} onPick={(d) => void pick(d)} />
        </div>
        {entries.map((entry) => {
          const card = cards.find((c) => c.id === entry.cardId)
          if (!card) return null
          return (
            <section
              key={entry.date}
              ref={(el) => {
                if (el) sectionRefs.current.set(entry.date, el)
                else sectionRefs.current.delete(entry.date)
              }}
              className="mb-10 scroll-mt-4 rounded-lg"
            >
              <h2 className="mb-1 flex items-baseline gap-2 border-b border-gray-100 pb-2 text-lg font-semibold text-gray-800">
                <button
                  type="button"
                  onClick={() => void pick(entry.date)}
                  className="hover:underline"
                >
                  {formatDate(entry.date)}
                </button>
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
