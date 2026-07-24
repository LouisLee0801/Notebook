import Dexie, { type EntityTable, type Table } from 'dexie'
import type {
  BoardEdge,
  BoardNote,
  Card,
  CardInstance,
  CardLink,
  CardTag,
  Folder,
  JournalEntry,
  Section,
  Tag,
  Whiteboard,
} from '../types'

// 本地持久化（IndexedDB）。Plan A+ 中此層日後將成為 Supabase 的本地快取，
// UI 一律透過 repository 存取，不直接碰這裡。
export const db = new Dexie('notebook') as Dexie & {
  cards: EntityTable<Card, 'id'>
  whiteboards: EntityTable<Whiteboard, 'id'>
  cardInstances: EntityTable<CardInstance, 'id'>
  boardEdges: EntityTable<BoardEdge, 'id'>
  cardLinks: Table<CardLink, [string, string]> // 複合主鍵 [fromCardId+toCardId]
  journal: EntityTable<JournalEntry, 'date'>
  tags: EntityTable<Tag, 'id'>
  cardTags: Table<CardTag, [string, string]> // 複合主鍵 [cardId+tagId]
  sections: EntityTable<Section, 'id'>
  boardNotes: EntityTable<BoardNote, 'id'>
  folders: EntityTable<Folder, 'id'>
  outbox: EntityTable<OutboxEntry, 'seq'>
}

// 待同步佇列：本地變更先記在這，登入且連線時依序推上 Supabase
export interface OutboxEntry {
  seq?: number
  table: string
  op: 'upsert' | 'delete'
  key: Record<string, string>
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

db.version(3).stores({
  cards: 'id, updatedAt, createdAt, deletedAt',
  whiteboards: 'id, updatedAt, name',
  cardInstances: 'id, whiteboardId, cardId',
  boardEdges: 'id, whiteboardId, fromInstanceId, toInstanceId',
  cardLinks: '[fromCardId+toCardId], fromCardId, toCardId',
  journal: 'date, cardId',
})

db.version(4).stores({
  cards: 'id, updatedAt, createdAt, deletedAt',
  whiteboards: 'id, updatedAt, name',
  cardInstances: 'id, whiteboardId, cardId',
  boardEdges: 'id, whiteboardId, fromInstanceId, toInstanceId',
  cardLinks: '[fromCardId+toCardId], fromCardId, toCardId',
  journal: 'date, cardId',
  tags: 'id, name',
  cardTags: '[cardId+tagId], cardId, tagId',
})

db.version(5).stores({
  cards: 'id, updatedAt, createdAt, deletedAt',
  whiteboards: 'id, updatedAt, name',
  cardInstances: 'id, whiteboardId, cardId',
  boardEdges: 'id, whiteboardId, fromInstanceId, toInstanceId',
  cardLinks: '[fromCardId+toCardId], fromCardId, toCardId',
  journal: 'date, cardId',
  tags: 'id, name',
  cardTags: '[cardId+tagId], cardId, tagId',
  sections: 'id, whiteboardId',
  boardNotes: 'id, whiteboardId',
})

db.version(6).stores({
  cards: 'id, updatedAt, createdAt, deletedAt',
  whiteboards: 'id, updatedAt, name',
  cardInstances: 'id, whiteboardId, cardId',
  boardEdges: 'id, whiteboardId, fromInstanceId, toInstanceId',
  cardLinks: '[fromCardId+toCardId], fromCardId, toCardId',
  journal: 'date, cardId',
  tags: 'id, name',
  cardTags: '[cardId+tagId], cardId, tagId',
  sections: 'id, whiteboardId',
  boardNotes: 'id, whiteboardId',
  outbox: '++seq',
})

db.version(7).stores({
  cards: 'id, updatedAt, createdAt, deletedAt, folderId',
  whiteboards: 'id, updatedAt, name',
  cardInstances: 'id, whiteboardId, cardId',
  boardEdges: 'id, whiteboardId, fromInstanceId, toInstanceId',
  cardLinks: '[fromCardId+toCardId], fromCardId, toCardId',
  journal: 'date, cardId',
  tags: 'id, name',
  cardTags: '[cardId+tagId], cardId, tagId',
  sections: 'id, whiteboardId',
  boardNotes: 'id, whiteboardId',
  folders: 'id, updatedAt, name',
  outbox: '++seq',
})
