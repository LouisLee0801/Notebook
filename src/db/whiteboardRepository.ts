import { db } from './database'
import type { BoardEdge, CardInstance, Whiteboard } from '../types'

export const whiteboardRepository = {
  async list(): Promise<Whiteboard[]> {
    return db.whiteboards.orderBy('updatedAt').reverse().toArray()
  },

  async create(name: string, now = Date.now()): Promise<Whiteboard> {
    const board: Whiteboard = {
      id: crypto.randomUUID(),
      name,
      parentId: null,
      createdAt: now,
      updatedAt: now,
    }
    await db.whiteboards.add(board)
    return board
  },

  async rename(id: string, name: string, now = Date.now()): Promise<void> {
    await db.whiteboards.update(id, { name, updatedAt: now })
  },

  /** 刪除白板連同其上的實例與連線；卡片本身不受影響 */
  async remove(id: string): Promise<void> {
    await db.transaction('rw', [db.whiteboards, db.cardInstances, db.boardEdges], async () => {
      await db.cardInstances.where('whiteboardId').equals(id).delete()
      await db.boardEdges.where('whiteboardId').equals(id).delete()
      await db.whiteboards.delete(id)
    })
  },
}

export const boardItemsRepository = {
  async listByBoard(
    whiteboardId: string,
  ): Promise<{ instances: CardInstance[]; edges: BoardEdge[] }> {
    const [instances, edges] = await Promise.all([
      db.cardInstances.where('whiteboardId').equals(whiteboardId).toArray(),
      db.boardEdges.where('whiteboardId').equals(whiteboardId).toArray(),
    ])
    return { instances, edges }
  },

  async addInstance(
    whiteboardId: string,
    cardId: string,
    x: number,
    y: number,
  ): Promise<CardInstance> {
    const instance: CardInstance = {
      id: crypto.randomUUID(),
      whiteboardId,
      cardId,
      x,
      y,
      width: 280,
      height: 0,
      color: null,
      sectionId: null,
    }
    await db.cardInstances.add(instance)
    return instance
  },

  async moveInstance(id: string, x: number, y: number): Promise<void> {
    await db.cardInstances.update(id, { x, y })
  },

  async resizeInstance(
    id: string,
    rect: { x: number; y: number; width: number; height: number },
  ): Promise<void> {
    await db.cardInstances.update(id, rect)
  },

  /** 從白板移除實例，並清掉連到它的線；卡片本身不受影響 */
  async removeInstance(id: string): Promise<void> {
    await db.transaction('rw', [db.cardInstances, db.boardEdges], async () => {
      await db.boardEdges.where('fromInstanceId').equals(id).delete()
      await db.boardEdges.where('toInstanceId').equals(id).delete()
      await db.cardInstances.delete(id)
    })
  },

  async addEdge(edge: BoardEdge): Promise<void> {
    await db.boardEdges.add(edge)
  },

  async updateEdgeLabel(id: string, label: string | null): Promise<void> {
    await db.boardEdges.update(id, { label })
  },

  async removeEdge(id: string): Promise<void> {
    await db.boardEdges.delete(id)
  },
}
