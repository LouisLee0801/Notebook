// 未連結提及（features.md 模組 4 P1）：
// 內文出現某卡片標題但沒加連結時偵測出來，並可一鍵轉為 cardLink。

import type { Card } from '../types'
import { extractText } from './text'

interface Mark {
  type: string
  attrs?: Record<string, unknown>
}

interface ContentNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: Mark[]
  content?: ContentNode[]
}

/** target 的標題出現在 card 內文，且 card 尚未連到 target */
export function findUnlinkedMentions(
  cards: Card[],
  target: Card,
  linkedFromIds: Set<string>,
): { card: Card; snippet: string }[] {
  const title = target.title.trim()
  if (!title) return []
  const results: { card: Card; snippet: string }[] = []
  for (const card of cards) {
    if (card.id === target.id || linkedFromIds.has(card.id)) continue
    const text = extractText(card.content)
    const idx = text.indexOf(title)
    if (idx < 0) continue
    const start = Math.max(0, idx - 20)
    const snippet =
      (start > 0 ? '…' : '') + text.slice(start, idx + title.length + 40).replace(/\n/g, ' ')
    results.push({ card, snippet })
  }
  return results
}

/** 把內容中所有出現的 title 文字轉成 cardLink 節點（略過程式碼區塊），回傳新內容與轉換次數 */
export function convertMentionsToLinks(
  content: unknown,
  title: string,
  cardId: string,
): { content: unknown; converted: number } {
  let converted = 0

  const transform = (node: ContentNode): ContentNode => {
    if (node.type === 'codeBlock' || !node.content) return node
    const children: ContentNode[] = []
    for (const child of node.content) {
      if (child.type !== 'text' || !child.text?.includes(title)) {
        children.push(transform(child))
        continue
      }
      const parts = child.text.split(title)
      parts.forEach((part, i) => {
        if (part) children.push({ ...child, text: part })
        if (i < parts.length - 1) {
          children.push({ type: 'cardLink', attrs: { cardId, label: title } })
          converted += 1
        }
      })
    }
    return { ...node, content: children }
  }

  const doc = transform(content as ContentNode)
  return { content: doc, converted }
}
