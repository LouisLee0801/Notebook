// 從 TipTap JSON 取出純文字（全文搜尋、Markdown 匯出共用）

interface ContentNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: ContentNode[]
}

export function extractText(content: unknown): string {
  const walk = (node: ContentNode | undefined): string => {
    if (!node) return ''
    if (node.type === 'text') return node.text ?? ''
    if (node.type === 'cardLink') return String(node.attrs?.label ?? '')
    const inner = (node.content ?? []).map(walk).join(node.type === 'doc' ? '\n' : '')
    return inner
  }
  return walk(content as ContentNode)
}

export interface SearchResult {
  id: string
  title: string
  snippet: string
}

/** 標題與內文的簡易全文搜尋（個人量級在記憶體掃描即可，之後換 Supabase tsvector） */
export function searchCards(
  cards: { id: string; title: string; content: unknown }[],
  query: string,
  limit = 20,
): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const results: SearchResult[] = []
  for (const card of cards) {
    const titleHit = card.title.toLowerCase().includes(q)
    const text = extractText(card.content)
    const idx = text.toLowerCase().indexOf(q)
    if (!titleHit && idx < 0) continue
    let snippet = ''
    if (idx >= 0) {
      const start = Math.max(0, idx - 20)
      snippet =
        (start > 0 ? '…' : '') + text.slice(start, idx + q.length + 40).replace(/\n/g, ' ')
    }
    // 標題命中排前面
    results[titleHit ? 'unshift' : 'push']({ id: card.id, title: card.title, snippet })
    if (results.length >= limit) break
  }
  return results
}
