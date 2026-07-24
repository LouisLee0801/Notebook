import { create } from 'zustand'
import type { Folder } from '../types'
import { folderRepository } from '../db/folderRepository'
import { useCardStore } from './useCardStore'

interface FolderStore {
  folders: Folder[]
  load: () => Promise<void>
  createFolder: (name: string) => Promise<void>
  renameFolder: (id: string, name: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
}

export const useFolderStore = create<FolderStore>((set, get) => ({
  folders: [],

  load: async () => {
    set({ folders: await folderRepository.list() })
  },

  createFolder: async (name) => {
    const folder = await folderRepository.create(name)
    set({ folders: [...get().folders, folder].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')) })
  },

  renameFolder: async (id, name) => {
    await folderRepository.rename(id, name)
    set({
      folders: get()
        .folders.map((f) => (f.id === id ? { ...f, name } : f))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')),
    })
  },

  deleteFolder: async (id) => {
    await folderRepository.remove(id)
    set({ folders: get().folders.filter((f) => f.id !== id) })
    // 夾內卡片已改為未分類，重新載入卡片
    await useCardStore.getState().load()
  },
}))
