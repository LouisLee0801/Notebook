import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './database'
import { cardRepository } from './cardRepository'

describe('cardRepository', () => {
  beforeEach(async () => {
    await db.cards.clear()
  })

  it('creates a card and lists it', async () => {
    const card = await cardRepository.create(1000)
    const cards = await cardRepository.list()
    expect(cards).toHaveLength(1)
    expect(cards[0].id).toBe(card.id)
    expect(cards[0].createdAt).toBe(1000)
  })

  it('updates title and bumps updatedAt', async () => {
    const card = await cardRepository.create(1000)
    await cardRepository.update(card.id, { title: '哈囉' }, 2000)
    const updated = await cardRepository.get(card.id)
    expect(updated?.title).toBe('哈囉')
    expect(updated?.updatedAt).toBe(2000)
  })

  it('lists cards sorted by updatedAt descending', async () => {
    const a = await cardRepository.create(1000)
    const b = await cardRepository.create(2000)
    await cardRepository.update(a.id, { title: 'a' }, 3000)
    const cards = await cardRepository.list()
    expect(cards.map((c) => c.id)).toEqual([a.id, b.id])
  })

  it('soft-deleted cards disappear from list but stay in db', async () => {
    const card = await cardRepository.create(1000)
    await cardRepository.softDelete(card.id, 2000)
    expect(await cardRepository.list()).toHaveLength(0)
    const raw = await db.cards.get(card.id)
    expect(raw?.deletedAt).toBe(2000)
  })
})
