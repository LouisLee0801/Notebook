import { db } from './database'
import { createEmptyCard, type JournalEntry } from '../types'

export function todayString(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 日誌本質上是「以日期為 key 的特殊卡片」（docs/data-model.md 設計要點 3）
export const journalRepository = {
  /** 由新到舊 */
  async list(): Promise<JournalEntry[]> {
    const entries = await db.journal.orderBy('date').reverse().toArray()
    return entries
  },

  /** 取得某天的日誌，沒有就建立（卡片標題 = 日期字串） */
  async getOrCreate(date: string, now = Date.now()): Promise<JournalEntry> {
    const existing = await db.journal.get(date)
    if (existing) return existing
    const card = { ...createEmptyCard(now), title: date }
    const entry: JournalEntry = { date, cardId: card.id }
    await db.transaction('rw', [db.cards, db.journal], async () => {
      await db.cards.add(card)
      await db.journal.add(entry)
    })
    return entry
  },
}
