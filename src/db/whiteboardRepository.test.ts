import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './database'
import { cardRepository } from './cardRepository'
import { boardItemsRepository, whiteboardRepository } from './whiteboardRepository'

describe('whiteboardRepository', () => {
  beforeEach(async () => {
    await Promise.all([
      db.cards.clear(),
      db.whiteboards.clear(),
      db.cardInstances.clear(),
      db.boardEdges.clear(),
    ])
  })

  it('creates and renames a whiteboard', async () => {
    const board = await whiteboardRepository.create('思考板', 1000)
    await whiteboardRepository.rename(board.id, '新名字', 2000)
    const boards = await whiteboardRepository.list()
    expect(boards).toHaveLength(1)
    expect(boards[0].name).toBe('新名字')
  })

  it('same card can appear on two boards (一卡多板)', async () => {
    const card = await cardRepository.create()
    const a = await whiteboardRepository.create('A')
    const b = await whiteboardRepository.create('B')
    await boardItemsRepository.addInstance(a.id, card.id, 0, 0)
    await boardItemsRepository.addInstance(b.id, card.id, 100, 100)

    const onA = await boardItemsRepository.listByBoard(a.id)
    const onB = await boardItemsRepository.listByBoard(b.id)
    expect(onA.instances[0].cardId).toBe(card.id)
    expect(onB.instances[0].cardId).toBe(card.id)
    // 內容單一來源：兩板實例都指向同一張卡
    await cardRepository.update(card.id, { title: '改了' })
    expect((await cardRepository.get(card.id))?.title).toBe('改了')
  })

  it('removing an instance cascades its edges', async () => {
    const card = await cardRepository.create()
    const board = await whiteboardRepository.create('A')
    const i1 = await boardItemsRepository.addInstance(board.id, card.id, 0, 0)
    const i2 = await boardItemsRepository.addInstance(board.id, card.id, 200, 0)
    await boardItemsRepository.addEdge({
      id: 'e1',
      whiteboardId: board.id,
      fromInstanceId: i1.id,
      toInstanceId: i2.id,
      label: null,
      arrow: 'forward',
    })

    await boardItemsRepository.removeInstance(i1.id)
    const { instances, edges } = await boardItemsRepository.listByBoard(board.id)
    expect(instances).toHaveLength(1)
    expect(edges).toHaveLength(0)
  })

  it('deleting a board removes its items but keeps cards', async () => {
    const card = await cardRepository.create()
    const board = await whiteboardRepository.create('A')
    await boardItemsRepository.addInstance(board.id, card.id, 0, 0)
    await whiteboardRepository.remove(board.id)

    expect(await whiteboardRepository.list()).toHaveLength(0)
    expect(await db.cardInstances.count()).toBe(0)
    expect(await cardRepository.get(card.id)).toBeDefined()
  })
})
