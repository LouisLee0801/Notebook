import { create } from 'zustand'
import type { Folder, FolderKind } from '../types'
import { folderRepository } from '../db/folderRepository'
import { useCardStore } from './useCardStore'
import { useWhiteboardStore } from './useWhiteboardStore'

const byName = (a: Folder, b: Folder) => a.name.localeCompare(b.name, 'zh-Hant')

interface FolderStore {
  /** 卡片庫的資料夾（#8） */
  folders: Folder[]
  /** 白板的資料夾（#1） */
  boardFolders: Folder[]
  load: () => Promise<void>
  createFolder: (name: string, kind?: FolderKind) => Promise<void>
  renameFolder: (id: string, name: string, kind?: FolderKind) => Promise<void>
  /** 側邊欄展開／收合（存進資料庫，換電腦也保留） */
  setFolderCollapsed: (id: string, collapsed: boolean, kind?: FolderKind) => Promise<void>
  deleteFolder: (id: string, kind?: FolderKind) => Promise<void>
}

export const useFolderStore = create<FolderStore>((set, get) => ({
  folders: [],
  boardFolders: [],

  load: async () => {
    const [folders, boardFolders] = await Promise.all([
      folderRepository.list('card'),
      folderRepository.list('board'),
    ])
    set({ folders, boardFolders })
  },

  createFolder: async (name, kind = 'card') => {
    const folder = await folderRepository.create(name, kind)
    if (kind === 'board') set({ boardFolders: [...get().boardFolders, folder].sort(byName) })
    else set({ folders: [...get().folders, folder].sort(byName) })
  },

  renameFolder: async (id, name, kind = 'card') => {
    await folderRepository.rename(id, name)
    const rename = (list: Folder[]) =>
      list.map((f) => (f.id === id ? { ...f, name } : f)).sort(byName)
    if (kind === 'board') set({ boardFolders: rename(get().boardFolders) })
    else set({ folders: rename(get().folders) })
  },

  setFolderCollapsed: async (id, collapsed, kind = 'card') => {
    await folderRepository.setCollapsed(id, collapsed)
    const apply = (list: Folder[]) => list.map((f) => (f.id === id ? { ...f, collapsed } : f))
    if (kind === 'board') set({ boardFolders: apply(get().boardFolders) })
    else set({ folders: apply(get().folders) })
  },

  deleteFolder: async (id, kind = 'card') => {
    await folderRepository.remove(id)
    if (kind === 'board') {
      set({ boardFolders: get().boardFolders.filter((f) => f.id !== id) })
      // 夾內白板已改為未分類，重新載入白板清單
      await useWhiteboardStore.getState().load()
    } else {
      set({ folders: get().folders.filter((f) => f.id !== id) })
      await useCardStore.getState().load()
    }
  },
}))
