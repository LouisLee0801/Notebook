import { beforeEach, describe, expect, it } from 'vitest'
import { useBoardHistoryStore } from './useBoardHistoryStore'

describe('useBoardHistoryStore（#4 上一步）', () => {
  beforeEach(() => useBoardHistoryStore.getState().reset())

  it('undo 依序倒著執行，redo 再套回來', async () => {
    const log: string[] = []
    const store = useBoardHistoryStore.getState()
    store.push({ label: '移動', undo: () => { log.push('undo移動') }, redo: () => { log.push('redo移動') } })
    store.push({ label: '刪除', undo: () => { log.push('undo刪除') }, redo: () => { log.push('redo刪除') } })

    expect(await useBoardHistoryStore.getState().undo()).toBe('刪除')
    expect(await useBoardHistoryStore.getState().undo()).toBe('移動')
    expect(await useBoardHistoryStore.getState().undo()).toBeNull() // 沒東西可還原
    expect(log).toEqual(['undo刪除', 'undo移動'])

    expect(await useBoardHistoryStore.getState().redo()).toBe('移動')
    expect(log).toEqual(['undo刪除', 'undo移動', 'redo移動'])
  })

  it('有新操作就清掉重做鏈', async () => {
    const store = useBoardHistoryStore.getState()
    store.push({ label: 'A', undo: () => {}, redo: () => {} })
    await useBoardHistoryStore.getState().undo()
    expect(useBoardHistoryStore.getState().future).toHaveLength(1)

    useBoardHistoryStore.getState().push({ label: 'B', undo: () => {}, redo: () => {} })
    expect(useBoardHistoryStore.getState().future).toHaveLength(0)
  })

  it('undo/redo 執行期間產生的變更不會再記進歷史', async () => {
    const store = useBoardHistoryStore.getState()
    store.push({
      label: '刪除',
      // 還原時通常會觸發畫面事件，可能又呼叫 push；這裡不該被記錄
      undo: () => useBoardHistoryStore.getState().push({ label: '雜訊', undo: () => {}, redo: () => {} }),
      redo: () => {},
    })
    await useBoardHistoryStore.getState().undo()
    expect(useBoardHistoryStore.getState().past).toHaveLength(0)
  })
})
