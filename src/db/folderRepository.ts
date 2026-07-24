import { db } from './database'
import type { Folder } from '../types'

// 卡片資料夾（#8）。卡片以 card.folderId 指向資料夾；刪除資料夾時把卡片還原為未分類。
export const folderRepository = {
  async list(): Promise<Folder[]> {
    return db.folders.orderBy('name').toArray()
  },

  async create(name: string, now = Date.now()): Promise<Folder> {
    const folder: Folder = { id: crypto.randomUUID(), name: name.trim() || '新資料夾', createdAt: now, updatedAt: now }
    await db.folders.add(folder)
    return folder
  },

  async rename(id: string, name: string, now = Date.now()): Promise<void> {
    await db.folders.update(id, { name: name.trim(), updatedAt: now })
  },

  /** 刪除資料夾；其中的卡片改為未分類（不刪卡片） */
  async remove(id: string, now = Date.now()): Promise<void> {
    await db.transaction('rw', [db.folders, db.cards], async () => {
      const cards = await db.cards.where('folderId').equals(id).toArray()
      for (const card of cards) {
        await db.cards.update(card.id, { folderId: null, updatedAt: now })
      }
      await db.folders.delete(id)
    })
  },
}
