import type { CardTag, Tag } from '../types'

// 取出卡片上的標籤，並依使用者調整過的順序排列（#4）。
// 舊資料沒有 sortOrder，排在有排序的後面，彼此維持原本的載入順序。
export function tagsOfCard(cardId: string, cardTags: CardTag[], tags: Tag[]): Tag[] {
  const byId = new Map(tags.map((t) => [t.id, t]))
  return cardTags
    .filter((ct) => ct.cardId === cardId)
    .map((ct, i) => ({ ct, i }))
    .sort((a, b) => {
      const ao = a.ct.sortOrder
      const bo = b.ct.sortOrder
      if (ao == null && bo == null) return a.i - b.i
      if (ao == null) return 1
      if (bo == null) return -1
      return ao - bo
    })
    .map(({ ct }) => byId.get(ct.tagId))
    .filter((t): t is Tag => Boolean(t))
}

/** 標籤搜尋：不分大小寫的子字串比對（#1） */
export function matchTags(tags: Tag[], query: string): Tag[] {
  const q = query.trim().toLowerCase()
  if (!q) return tags
  return tags.filter((t) => t.name.toLowerCase().includes(q))
}

/** 把陣列中的元素從 from 移到 to（拖曳排序用） */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
