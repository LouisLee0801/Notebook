import { db } from './database'
import type { BoardEdge, BoardNote, CardInstance, Section, Whiteboard } from '../types'

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

  /** 刪除白板連同其上的實例、連線、區域與便利貼；卡片本身不受影響 */
  async remove(id: string): Promise<void> {
    await db.transaction(
      'rw',
      [db.whiteboards, db.cardInstances, db.boardEdges, db.sections, db.boardNotes],
      async () => {
        await db.cardInstances.where('whiteboardId').equals(id).delete()
        await db.boardEdges.where('whiteboardId').equals(id).delete()
        await db.sections.where('whiteboardId').equals(id).delete()
        await db.boardNotes.where('whiteboardId').equals(id).delete()
        await db.whiteboards.delete(id)
      },
    )
  },
}

export const boardItemsRepository = {
  async listByBoard(whiteboardId: string): Promise<{
    instances: CardInstance[]
    edges: BoardEdge[]
    sections: Section[]
    notes: BoardNote[]
  }> {
    const [instances, edges, sections, notes] = await Promise.all([
      db.cardInstances.where('whiteboardId').equals(whiteboardId).toArray(),
      db.boardEdges.where('whiteboardId').equals(whiteboardId).toArray(),
      db.sections.where('whiteboardId').equals(whiteboardId).toArray(),
      db.boardNotes.where('whiteboardId').equals(whiteboardId).toArray(),
    ])
    return { instances, edges, sections, notes }
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

  async setInstanceColor(id: string, color: string | null): Promise<void> {
    await db.cardInstances.update(id, { color })
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

  // ---- Section 區域 ----

  async addSection(whiteboardId: string, x: number, y: number): Promise<Section> {
    const section: Section = {
      id: crypto.randomUUID(),
      whiteboardId,
      name: '新區域',
      x,
      y,
      width: 420,
      height: 300,
      collapsed: false,
    }
    await db.sections.add(section)
    return section
  },

  async updateSection(
    id: string,
    patch: Partial<Pick<Section, 'name' | 'x' | 'y' | 'width' | 'height' | 'collapsed'>>,
  ): Promise<void> {
    await db.sections.update(id, patch)
  },

  async removeSection(id: string): Promise<void> {
    await db.sections.delete(id)
  },

  // ---- 便利貼 ----

  /** 跨白板列出所有便利貼（側邊欄總表用） */
  async listAllNotes(): Promise<BoardNote[]> {
    return db.boardNotes.toArray()
  },

  async addNote(whiteboardId: string, x: number, y: number): Promise<BoardNote> {
    const note: BoardNote = {
      id: crypto.randomUUID(),
      whiteboardId,
      text: '',
      x,
      y,
      width: 200,
      height: 140,
    }
    await db.boardNotes.add(note)
    return note
  },

  async updateNote(
    id: string,
    patch: Partial<Pick<BoardNote, 'text' | 'x' | 'y' | 'width' | 'height'>>,
  ): Promise<void> {
    await db.boardNotes.update(id, patch)
  },

  async removeNote(id: string): Promise<void> {
    await db.boardNotes.delete(id)
  },
}
