import { db } from './database'
import type { Folder, FolderKind } from '../types'

// 資料夾（#8 卡片、#1 白板）。卡片以 card.folderId、白板以 whiteboard.folderId 指向資料夾；
// 刪除資料夾時只把成員還原為未分類，不刪卡片/白板。
export const folderRepository = {
  /** 舊資料沒有 kind 欄位，一律當成卡片資料夾 */
  async list(kind: FolderKind = 'card'): Promise<Folder[]> {
    const all = await db.folders.orderBy('name').toArray()
    return all.filter((f) => (f.kind ?? 'card') === kind)
  },

  async create(name: string, kind: FolderKind = 'card', now = Date.now()): Promise<Folder> {
    const folder: Folder = {
      id: crypto.randomUUID(),
      name: name.trim() || '新資料夾',
      kind,
      createdAt: now,
      updatedAt: now,
    }
    await db.folders.add(folder)
    return folder
  },

  async rename(id: string, name: string, now = Date.now()): Promise<void> {
    await db.folders.update(id, { name: name.trim(), updatedAt: now })
  },

  /** 刪除資料夾；其中的卡片/白板改為未分類（不刪內容） */
  async remove(id: string, now = Date.now()): Promise<void> {
    await db.transaction('rw', [db.folders, db.cards, db.whiteboards], async () => {
      const cards = await db.cards.where('folderId').equals(id).toArray()
      for (const card of cards) {
        await db.cards.update(card.id, { folderId: null, updatedAt: now })
      }
      const boards = await db.whiteboards.where('folderId').equals(id).toArray()
      for (const board of boards) {
        await db.whiteboards.update(board.id, { folderId: null, updatedAt: now })
      }
      await db.folders.delete(id)
    })
  },
}
