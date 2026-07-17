import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './database'
import { tagRepository } from './tagRepository'

describe('tagRepository', () => {
  beforeEach(async () => {
    await Promise.all([db.tags.clear(), db.cardTags.clear()])
  })

  it('getOrCreate reuses existing tag by name', async () => {
    const a = await tagRepository.getOrCreate('閱讀')
    const b = await tagRepository.getOrCreate('閱讀')
    expect(b.id).toBe(a.id)
    expect(await db.tags.count()).toBe(1)
  })

  it('manages properties and values', async () => {
    const tag = await tagRepository.getOrCreate('書')
    await tagRepository.addToCard('card1', tag.id)
    await tagRepository.addProperty(tag.id, {
      id: 'p1',
      name: '狀態',
      type: 'select',
      options: ['待讀', '完成'],
    })

    await tagRepository.setValue('card1', tag.id, 'p1', '待讀')
    let ct = await db.cardTags.get(['card1', tag.id])
    expect(ct?.values.p1).toBe('待讀')

    // 清空值
    await tagRepository.setValue('card1', tag.id, 'p1', null)
    ct = await db.cardTags.get(['card1', tag.id])
    expect(ct?.values.p1).toBeUndefined()

    // 移除屬性會連同所有卡片上的值一起清掉
    await tagRepository.setValue('card1', tag.id, 'p1', '完成')
    await tagRepository.removeProperty(tag.id, 'p1')
    const updated = await db.tags.get(tag.id)
    expect(updated?.properties).toHaveLength(0)
    ct = await db.cardTags.get(['card1', tag.id])
    expect(ct?.values.p1).toBeUndefined()
  })

  it('deleting a tag removes card associations', async () => {
    const tag = await tagRepository.getOrCreate('暫時')
    await tagRepository.addToCard('card1', tag.id)
    await tagRepository.remove(tag.id)
    expect(await db.cardTags.count()).toBe(0)
  })
})
