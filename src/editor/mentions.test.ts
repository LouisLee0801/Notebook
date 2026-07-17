import { describe, expect, it } from 'vitest'
import { convertMentionsToLinks, findUnlinkedMentions } from './mentions'
import type { Card } from '../types'

const makeCard = (id: string, title: string, text: string): Card => ({
  id,
  title,
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  },
  createdAt: 0,
  updatedAt: 0,
  archivedAt: null,
  deletedAt: null,
})

describe('findUnlinkedMentions', () => {
  it('finds cards mentioning the title without a link', () => {
    const target = makeCard('t', '知識管理', '')
    const mentioner = makeCard('a', '筆記', '這篇談知識管理的方法')
    const linked = makeCard('b', '已連結', '知識管理已經連過')
    const unrelated = makeCard('c', '無關', '完全無關的內容')

    const result = findUnlinkedMentions(
      [target, mentioner, linked, unrelated],
      target,
      new Set(['b']),
    )
    expect(result.map((r) => r.card.id)).toEqual(['a'])
    expect(result[0].snippet).toContain('知識管理')
  })

  it('returns nothing for empty titles', () => {
    const target = makeCard('t', '', '')
    expect(findUnlinkedMentions([makeCard('a', 'x', 'yyy')], target, new Set())).toEqual([])
  })
})

describe('convertMentionsToLinks', () => {
  it('replaces title text with cardLink nodes, preserving surroundings', () => {
    const card = makeCard('a', '筆記', '前面 知識管理 後面，再提知識管理一次')
    const { content, converted } = convertMentionsToLinks(card.content, '知識管理', 't')
    expect(converted).toBe(2)
    const para = (content as { content: { content: unknown[] }[] }).content[0]
    const types = (para.content as { type: string; text?: string }[]).map((n) => n.type)
    expect(types).toEqual(['text', 'cardLink', 'text', 'cardLink', 'text'])
  })

  it('skips code blocks', () => {
    const content = {
      type: 'doc',
      content: [
        { type: 'codeBlock', content: [{ type: 'text', text: '知識管理 in code' }] },
      ],
    }
    const { converted } = convertMentionsToLinks(content, '知識管理', 't')
    expect(converted).toBe(0)
  })
})
