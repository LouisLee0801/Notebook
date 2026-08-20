import type { CardInstance } from '../types'
import { boardItemsRepository } from './whiteboardRepository'

// 卡片收合狀態原本存在瀏覽器的 localStorage（換電腦就沒了）。
// 現在改存進 cardInstances 跟著帳號同步；這裡把本機舊資料搬進資料庫一次，
// 讓已經在用的電腦不會因為改版而整片展開。
const LEGACY_KEY = 'notebook-card-collapsed'

function legacyCollapsed(instanceId: string): boolean {
  try {
    return localStorage.getItem(`${LEGACY_KEY}:${instanceId}`) === '1'
  } catch {
    return false // 無痕模式等
  }
}

function clearLegacy(instanceId: string): void {
  try {
    localStorage.removeItem(`${LEGACY_KEY}:${instanceId}`)
  } catch {
    /* 忽略 */
  }
}

/**
 * 回傳補上收合狀態的實例清單；只有「資料庫還沒有這個欄位、
 * 而本機舊資料說它是收合的」才需要寫回資料庫。
 */
export async function adoptLegacyCollapse(instances: CardInstance[]): Promise<CardInstance[]> {
  return Promise.all(
    instances.map(async (instance) => {
      if (instance.collapsed !== undefined) {
        clearLegacy(instance.id) // 資料庫已是準的，本機殘留可以清掉
        return instance
      }
      const collapsed = legacyCollapsed(instance.id)
      await boardItemsRepository.setInstanceCollapsed(instance.id, collapsed)
      clearLegacy(instance.id)
      return { ...instance, collapsed }
    }),
  )
}
