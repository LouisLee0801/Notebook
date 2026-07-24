import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './database'
import { cardRepository } from './cardRepository'
import { folderRepository } from './folderRepository'

describe('folderRepository', () => {
  beforeEach(async () => {
    await Promise.all([db.cards.clear(), db.folders.clear()])
  })

  it('creates and renames a folder', async () => {
    const f = await folderRepository.create('專案 A', 1000)
    await folderRepository.rename(f.id, '專案 B', 2000)
    const list = await folderRepository.list()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('專案 B')
  })

  it('assigns a card to a folder and lists it', async () => {
    const f = await folderRepository.create('收藏')
    const card = await cardRepository.create(1000, f.id)
    expect((await cardRepository.get(card.id))?.folderId).toBe(f.id)
    const inFolder = await db.cards.where('folderId').equals(f.id).toArray()
    expect(inFolder.map((c) => c.id)).toEqual([card.id])
  })

  it('deleting a folder unfiles its cards but keeps them', async () => {
    const f = await folderRepository.create('暫存')
    const card = await cardRepository.create(1000, f.id)
    await folderRepository.remove(f.id)
    expect(await folderRepository.list()).toHaveLength(0)
    const still = await cardRepository.get(card.id)
    expect(still).toBeDefined()
    expect(still?.folderId).toBeNull()
  })
})
