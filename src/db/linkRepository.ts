import { db } from './database'
import type { CardLink } from '../types'

// CardLink 由系統維護（docs/data-model.md 設計要點 2）：
// 儲存卡片時解析內文的 cardLink 節點重建連結，反向連結面板查 toCardId。

interface ContentNode {
  type?: string
  attrs?: Record<string, unknown>
  content?: ContentNode[]
}

/** 從 TipTap JSON 內容取出所有被連結的卡片 id（去重） */
export function extractCardLinkIds(content: unknown): string[] {
  const ids = new Set<string>()
  const walk = (node: ContentNode | undefined) => {
    if (!node) return
    if (node.type === 'cardLink' && typeof node.attrs?.cardId === 'string') {
      ids.add(node.attrs.cardId)
    }
    node.content?.forEach(walk)
  }
  walk(content as ContentNode)
  return [...ids]
}

/** 取出「包含指向 targetCardId 連結」的區塊純文字，作為反向連結的上下文預覽 */
export function findLinkContext(content: unknown, targetCardId: string): string {
  const textOf = (node: ContentNode): string => {
    if (node.type === 'text') return (node as { text?: string }).text ?? ''
    if (node.type === 'cardLink') return `[[${String(node.attrs?.label ?? '')}]]`
    return (node.content ?? []).map(textOf).join('')
  }
  const containsLink = (node: ContentNode): boolean => {
    if (node.type === 'cardLink' && node.attrs?.cardId === targetCardId) return true
    return (node.content ?? []).some(containsLink)
  }
  const blocks = (content as ContentNode)?.content ?? []
  const queue = [...blocks]
  while (queue.length > 0) {
    const block = queue.shift()!
    if (!containsLink(block)) continue
    // 往下鑽到最小的含連結區塊（清單項目裡的段落等）
    const child = (block.content ?? []).find(containsLink)
    if (child && (child.content ?? []).some(containsLink)) {
      queue.unshift(child)
      continue
    }
    return textOf(block).trim()
  }
  return ''
}

export const linkRepository = {
  /** 依卡片最新內容重建其對外連結 */
  async rebuildFromContent(fromCardId: string, content: unknown): Promise<void> {
    const toCardIds = extractCardLinkIds(content)
    await db.transaction('rw', db.cardLinks, async () => {
      await db.cardLinks.where('fromCardId').equals(fromCardId).delete()
      await db.cardLinks.bulkAdd(
        toCardIds.map((toCardId) => ({ fromCardId, fromBlockId: '', toCardId })),
      )
    })
  },

  /** 哪些卡片連到我 */
  async backlinks(toCardId: string): Promise<CardLink[]> {
    return db.cardLinks.where('toCardId').equals(toCardId).toArray()
  },
}
