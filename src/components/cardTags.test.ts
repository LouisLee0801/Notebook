import { describe, expect, it } from 'vitest'
import type { CardTag, Tag } from '../types'
import { matchTags, moveItem, tagsOfCard } from './cardTags'

const tag = (id: string, name: string): Tag => ({ id, name, properties: [], color: null })
const link = (cardId: string, tagId: string, sortOrder?: number): CardTag => ({
  cardId,
  tagId,
  values: {},
  ...(sortOrder === undefined ? {} : { sortOrder }),
})

describe('tagsOfCard（#4 標籤排序）', () => {
  const tags = [tag('a', '投資'), tag('b', '筆記'), tag('c', '待辦')]

  it('依 sortOrder 排列', () => {
    const cardTags = [link('1', 'a', 3), link('1', 'b', 1), link('1', 'c', 2)]
    expect(tagsOfCard('1', cardTags, tags).map((t) => t.name)).toEqual(['筆記', '待辦', '投資'])
  })

  it('只取該張卡片的標籤', () => {
    const cardTags = [link('1', 'a', 1), link('2', 'b', 1)]
    expect(tagsOfCard('1', cardTags, tags).map((t) => t.id)).toEqual(['a'])
  })

  it('舊資料（沒有 sortOrder）排在有排序的後面，並保持原順序', () => {
    const cardTags = [link('1', 'a'), link('1', 'b', 1), link('1', 'c')]
    expect(tagsOfCard('1', cardTags, tags).map((t) => t.name)).toEqual(['筆記', '投資', '待辦'])
  })

  it('略過已被刪除的標籤', () => {
    const cardTags = [link('1', 'a', 1), link('1', 'zzz', 2)]
    expect(tagsOfCard('1', cardTags, tags).map((t) => t.id)).toEqual(['a'])
  })
})

describe('matchTags（#1 標籤搜尋）', () => {
  const tags = [tag('a', '投資筆記'), tag('b', 'Reading'), tag('c', '待辦')]

  it('子字串比對且不分大小寫', () => {
    expect(matchTags(tags, '筆記').map((t) => t.id)).toEqual(['a'])
    expect(matchTags(tags, 'read').map((t) => t.id)).toEqual(['b'])
  })

  it('空字串回傳全部', () => {
    expect(matchTags(tags, '  ')).toHaveLength(3)
  })
})

describe('moveItem（拖曳排序）', () => {
  it('往後移', () => expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']))
  it('往前移', () => expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']))
  it('相同位置或超出範圍時原樣回傳', () => {
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
  })
})
