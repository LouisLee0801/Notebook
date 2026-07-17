import Dexie, { type EntityTable } from 'dexie'
import type { BoardEdge, Card, CardInstance, Whiteboard } from '../types'

// 本地持久化（IndexedDB）。Plan A+ 中此層日後將成為 Supabase 的本地快取，
// UI 一律透過 repository 存取，不直接碰這裡。
export const db = new Dexie('notebook') as Dexie & {
  cards: EntityTable<Card, 'id'>
  whiteboards: EntityTable<Whiteboard, 'id'>
  cardInstances: EntityTable<CardInstance, 'id'>
  boardEdges: EntityTable<BoardEdge, 'id'>
}

db.version(1).stores({
  cards: 'id, updatedAt, createdAt, deletedAt',
})

db.version(2).stores({
  cards: 'id, updatedAt, createdAt, deletedAt',
  whiteboards: 'id, updatedAt, name',
  cardInstances: 'id, whiteboardId, cardId',
  boardEdges: 'id, whiteboardId, fromInstanceId, toInstanceId',
})
