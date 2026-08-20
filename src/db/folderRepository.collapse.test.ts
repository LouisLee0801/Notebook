import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './database'
import { folderRepository } from './folderRepository'

describe('資料夾收合狀態（跨裝置保留）', () => {
  beforeEach(async () => {
    await db.folders.clear()
  })

  it('新資料夾預設展開', async () => {
    const folder = await folderRepository.create('研究專案', 'board')
    expect(folder.collapsed).toBe(false)
  })

  it('收合狀態寫入後讀得回來，且不影響其他欄位', async () => {
    const folder = await folderRepository.create('研究專案', 'board')
    await folderRepository.setCollapsed(folder.id, true)

    const [saved] = await folderRepository.list('board')
    expect(saved.collapsed).toBe(true)
    expect(saved.name).toBe('研究專案')
    expect(saved.kind).toBe('board')
  })

  it('改名不會弄丟收合狀態', async () => {
    const folder = await folderRepository.create('舊名', 'card')
    await folderRepository.setCollapsed(folder.id, true)
    await folderRepository.rename(folder.id, '新名')

    const [saved] = await folderRepository.list('card')
    expect(saved.name).toBe('新名')
    expect(saved.collapsed).toBe(true)
  })
})
