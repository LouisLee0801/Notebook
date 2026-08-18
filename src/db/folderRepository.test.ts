import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './database'
import { cardRepository } from './cardRepository'
import { folderRepository } from './folderRepository'
import { whiteboardRepository } from './whiteboardRepository'

describe('folderRepository', () => {
  beforeEach(async () => {
    await Promise.all([db.cards.clear(), db.folders.clear(), db.whiteboards.clear()])
  })

  it('creates and renames a folder', async () => {
    const f = await folderRepository.create('專案 A', 'card', 1000)
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

  // ---- 白板資料夾（#1）----

  it('卡片資料夾與白板資料夾各自獨立', async () => {
    await folderRepository.create('卡片夾', 'card')
    await folderRepository.create('白板夾', 'board')

    expect((await folderRepository.list('card')).map((f) => f.name)).toEqual(['卡片夾'])
    expect((await folderRepository.list('board')).map((f) => f.name)).toEqual(['白板夾'])
  })

  it('舊資料沒有 kind 時視為卡片資料夾', async () => {
    await db.folders.add({ id: 'legacy', name: '舊資料夾', createdAt: 1, updatedAt: 1 })

    expect((await folderRepository.list('card')).map((f) => f.id)).toEqual(['legacy'])
    expect(await folderRepository.list('board')).toHaveLength(0)
  })

  it('把白板搬進資料夾，刪除資料夾後白板還在（變成未分類）', async () => {
    const folder = await folderRepository.create('研究專案', 'board')
    const board = await whiteboardRepository.create('思考板')
    await whiteboardRepository.setFolder([board.id], folder.id)

    expect((await db.whiteboards.get(board.id))?.folderId).toBe(folder.id)

    await folderRepository.remove(folder.id)
    const after = await db.whiteboards.get(board.id)
    expect(after).toBeDefined() // 白板不會被一起刪掉
    expect(after?.folderId).toBeNull()
  })
})
