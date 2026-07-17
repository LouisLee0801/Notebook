import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './database'
import { extractCardLinkIds, findLinkContext, linkRepository } from './linkRepository'

const doc = (targetId: string) => ({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: '無關段落' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '參考 ' },
        { type: 'cardLink', attrs: { cardId: targetId, label: '目標卡' } },
        { type: 'text', text: ' 的想法' },
      ],
    },
    {
      type: 'paragraph',
      content: [{ type: 'cardLink', attrs: { cardId: targetId, label: '目標卡' } }],
    },
  ],
})

describe('linkRepository', () => {
  beforeEach(async () => {
    await db.cardLinks.clear()
  })

  it('extracts and dedupes card link ids', () => {
    expect(extractCardLinkIds(doc('t1'))).toEqual(['t1'])
    expect(extractCardLinkIds({ type: 'doc', content: [] })).toEqual([])
  })

  it('finds the block text containing the link as context', () => {
    expect(findLinkContext(doc('t1'), 't1')).toBe('參考 [[目標卡]] 的想法')
    expect(findLinkContext(doc('t1'), 'other')).toBe('')
  })

  it('rebuilds links idempotently and answers backlinks', async () => {
    await linkRepository.rebuildFromContent('a', doc('t1'))
    await linkRepository.rebuildFromContent('a', doc('t1'))
    await linkRepository.rebuildFromContent('b', doc('t1'))

    const backlinks = await linkRepository.backlinks('t1')
    expect(backlinks.map((l) => l.fromCardId).sort()).toEqual(['a', 'b'])
  })

  it('removes stale links on rebuild', async () => {
    await linkRepository.rebuildFromContent('a', doc('t1'))
    await linkRepository.rebuildFromContent('a', { type: 'doc', content: [] })
    expect(await linkRepository.backlinks('t1')).toHaveLength(0)
  })
})
