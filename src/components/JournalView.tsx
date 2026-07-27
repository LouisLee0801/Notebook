import { useEffect, useState } from 'react'
import { useCardStore } from '../store/useCardStore'
import { useJournalStore } from '../store/useJournalStore'
import { todayString } from '../db/journalRepository'
import { taiwanHoliday } from '../util/taiwanHolidays'
import { CardEditor } from './CardEditor'
import { JournalCalendar } from './JournalCalendar'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`
}

// 判斷日誌是否「有內容」——只有空段落視為空白（決定是否顯示藍點，#11）
function hasDocContent(content: unknown): boolean {
  const doc = content as { content?: { content?: unknown[] }[] } | undefined
  if (!doc?.content) return false
  return doc.content.some((node) => Array.isArray(node.content) && node.content.length > 0)
}

// 日誌（features.md 模組 6 + #5 Journey）：
// 頂部日期導覽（本週＋下週，可展開月曆）；畫面只顯示「選到的那一天」的日誌。
// #11：藍點只在該天「真的有內容」時顯示；空白天不再卡在「載入中」，而是顯示可開始撰寫的提示。
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

  // 只切換選取日期，不再自動建立日誌（避免點過的每一天都冒出藍點）
  const pick = (date: string) => setSelected(date)

  const entryByDate = new Map(entries.map((e) => [e.date, e.cardId]))
  const cardById = new Map(cards.map((c) => [c.id, c]))

  // 藍點：只標記「有實際內容」的日子
  const entryDates = new Set<string>()
  for (const [date, cardId] of entryByDate) {
    const c = cardById.get(cardId)
    if (c && hasDocContent(c.content)) entryDates.add(date)
  }

  const selectedCardId = entryByDate.get(selected)
  const card = selectedCardId ? cardById.get(selectedCardId) : undefined
  const holiday = taiwanHoliday(selected)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-8 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">日誌</h1>
        <div className="mb-6">
          <JournalCalendar selected={selected} entryDates={entryDates} onPick={pick} />
        </div>

        <section>
          <h2 className="mb-2 flex flex-wrap items-baseline gap-2 border-b border-gray-100 pb-2 text-lg font-semibold text-gray-800">
            {formatDate(selected)}
            {selected === today && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                今天
              </span>
            )}
            {holiday && (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-600">
                {holiday}
              </span>
            )}
          </h2>
          {card ? (
            <CardEditor key={card.id} card={card} compact hideTitle />
          ) : (
            <button
              type="button"
              onClick={() => void ensureDate(selected)}
              className="mt-2 w-full rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-400 hover:border-gray-400 hover:bg-gray-50 hover:text-gray-600"
            >
              ＋ 這天還沒有日誌，點一下開始撰寫
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
