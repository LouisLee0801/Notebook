import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './database'
import { boardItemsRepository } from './whiteboardRepository'
import { adoptLegacyCollapse } from './collapseMigration'

// 測試環境沒有 localStorage，用最小替身模擬瀏覽器的舊資料
function stubLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  return store
}

describe('adoptLegacyCollapse（收合狀態從 localStorage 搬進資料庫）', () => {
  beforeEach(async () => {
    await db.cardInstances.clear()
    vi.unstubAllGlobals()
  })

  it('把本機記錄為收合的卡片寫進資料庫，並清掉本機殘留', async () => {
    const instance = await boardItemsRepository.addInstance('board-1', 'card-1', 0, 0)
    await db.cardInstances.update(instance.id, { collapsed: undefined })
    const store = stubLocalStorage({ [`notebook-card-collapsed:${instance.id}`]: '1' })

    const [result] = await adoptLegacyCollapse([{ ...instance, collapsed: undefined }])

    expect(result.collapsed).toBe(true)
    expect((await db.cardInstances.get(instance.id))?.collapsed).toBe(true)
    expect(store.has(`notebook-card-collapsed:${instance.id}`)).toBe(false)
  })

  it('本機沒有記錄的卡片視為展開', async () => {
    const instance = await boardItemsRepository.addInstance('board-1', 'card-1', 0, 0)
    stubLocalStorage()

    const [result] = await adoptLegacyCollapse([{ ...instance, collapsed: undefined }])

    expect(result.collapsed).toBe(false)
    expect((await db.cardInstances.get(instance.id))?.collapsed).toBe(false)
  })

  it('資料庫已有收合狀態時以資料庫為準（其他電腦改過就同步過來）', async () => {
    const instance = await boardItemsRepository.addInstance('board-1', 'card-1', 0, 0)
    await boardItemsRepository.setInstanceCollapsed(instance.id, true)
    // 本機舊資料說是展開，但資料庫說收合 —— 應以資料庫為準
    const store = stubLocalStorage()

    const [result] = await adoptLegacyCollapse([{ ...instance, collapsed: true }])

    expect(result.collapsed).toBe(true)
    expect(store.size).toBe(0)
  })

  it('無痕模式等讀不到 localStorage 時不會炸掉', async () => {
    const instance = await boardItemsRepository.addInstance('board-1', 'card-1', 0, 0)
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })

    const [result] = await adoptLegacyCollapse([{ ...instance, collapsed: undefined }])
    expect(result.collapsed).toBe(false)
  })
})

describe('收合狀態存進資料庫', () => {
  beforeEach(async () => {
    await Promise.all([db.cardInstances.clear(), db.folders.clear()])
  })

  it('卡片收合狀態可寫入與讀回', async () => {
    const instance = await boardItemsRepository.addInstance('board-1', 'card-1', 0, 0)
    expect(instance.collapsed).toBe(false)

    await boardItemsRepository.setInstanceCollapsed(instance.id, true)
    expect((await db.cardInstances.get(instance.id))?.collapsed).toBe(true)

    await boardItemsRepository.setInstanceCollapsed(instance.id, false)
    expect((await db.cardInstances.get(instance.id))?.collapsed).toBe(false)
  })
})
