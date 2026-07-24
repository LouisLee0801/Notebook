import { useState } from 'react'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function fromDateStr(s: string): Date {
  return new Date(`${s}T00:00:00`)
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function startOfWeek(d: Date): Date {
  // 週日為一週起始
  const x = new Date(d)
  x.setDate(x.getDate() - x.getDay())
  x.setHours(0, 0, 0, 0)
  return x
}
function sameYMD(a: Date, b: Date): boolean {
  return toDateStr(a) === toDateStr(b)
}

// 日誌日期導覽（#5 Journey）：
// 預設「兩週」模式顯示本週＋下週；可展開成整月月曆，或收合回兩週。
// 點任一日期 → 開啟（必要時建立）該天日誌。
export function JournalCalendar({
  selected,
  entryDates,
  onPick,
}: {
  selected: string
  entryDates: Set<string>
  onPick: (date: string) => void
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [mode, setMode] = useState<'weeks' | 'month'>('weeks')
  // 月曆模式檢視的月份（以該月一號表示）
  const [viewMonth, setViewMonth] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1))

  const selectedDate = fromDateStr(selected)

  const dayCell = (day: Date, dimmed = false) => {
    const str = toDateStr(day)
    const isToday = sameYMD(day, today)
    const isSelected = str === selected
    const hasEntry = entryDates.has(str)
    return (
      <button
        key={str}
        type="button"
        onClick={() => onPick(str)}
        aria-label={str}
        className={`relative flex h-9 flex-col items-center justify-center rounded-md text-sm transition ${
          isSelected
            ? 'bg-gray-900 font-semibold text-white'
            : isToday
              ? 'bg-amber-100 text-amber-800'
              : dimmed
                ? 'text-gray-300 hover:bg-gray-100'
                : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        {day.getDate()}
        {hasEntry && !isSelected && (
          <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-400" />
        )}
      </button>
    )
  }

  let body: React.ReactNode
  if (mode === 'weeks') {
    const start = startOfWeek(today)
    const days = Array.from({ length: 14 }, (_, i) => addDays(start, i))
    body = (
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[11px] text-gray-400">
            {w}
          </div>
        ))}
        {days.map((d) => dayCell(d))}
      </div>
    )
  } else {
    const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
    const gridStart = startOfWeek(firstOfMonth)
    const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
    body = (
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[11px] text-gray-400">
            {w}
          </div>
        ))}
        {days.map((d) => dayCell(d, d.getMonth() !== viewMonth.getMonth()))}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        {mode === 'month' ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="上個月"
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
              className="rounded px-1.5 text-gray-500 hover:bg-gray-100"
            >
              ‹
            </button>
            <span className="text-sm font-medium text-gray-800">
              {viewMonth.getFullYear()} 年 {viewMonth.getMonth() + 1} 月
            </span>
            <button
              type="button"
              aria-label="下個月"
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
              className="rounded px-1.5 text-gray-500 hover:bg-gray-100"
            >
              ›
            </button>
          </div>
        ) : (
          <span className="text-sm font-medium text-gray-800">本週與下週</span>
        )}
        <div className="flex items-center gap-1">
          {!sameYMD(selectedDate, today) && (
            <button
              type="button"
              onClick={() => {
                setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                onPick(toDateStr(today))
              }}
              className="rounded-md px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
            >
              今天
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setViewMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
              setMode(mode === 'weeks' ? 'month' : 'weeks')
            }}
            className="rounded-md px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
          >
            {mode === 'weeks' ? '展開月曆 ▾' : '收合兩週 ▴'}
          </button>
        </div>
      </div>
      {body}
    </div>
  )
}
