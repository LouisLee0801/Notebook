// 雲端同步引擎（Plan A+，docs/development-plans.md）
//
// 策略：Dexie（IndexedDB）維持是 UI 的工作儲存，離線完全可用；
// 本檔把每筆本地變更記進 outbox 佇列推上 Supabase（LWW），
// 並透過 Realtime 訂閱把其他裝置的變更套回本地。
//
// 已知限制（單人量級可接受）：outbox 記的是「鍵」，推送時讀當下整列；
// hook 與 outbox 寫入之間若剛好關閉分頁，該筆變更會等下次啟動的
// 首次同步補傳（僅補「遠端沒有的列」；同鍵較新的本地修改需再編輯一次）。

import type { RealtimePostgresChangesPayload, Session } from '@supabase/supabase-js'
import { db } from '../db/database'
import { supabase } from './supabaseClient'
import { useCardStore } from '../store/useCardStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import { useTagStore } from '../store/useTagStore'
import { useJournalStore } from '../store/useJournalStore'
import { useFolderStore } from '../store/useFolderStore'
import { useBoardNotesStore } from '../store/useBoardNotesStore'

interface TableSpec {
  name: string
  keys: string[]
  /** 有此欄位的表以 last-write-wins 解衝突 */
  lww?: 'updatedAt'
}

const TABLES: TableSpec[] = [
  { name: 'cards', keys: ['id'], lww: 'updatedAt' },
  { name: 'whiteboards', keys: ['id'], lww: 'updatedAt' },
  { name: 'cardInstances', keys: ['id'] },
  { name: 'boardEdges', keys: ['id'] },
  { name: 'sections', keys: ['id'] },
  { name: 'boardNotes', keys: ['id'] },
  { name: 'tags', keys: ['id'] },
  { name: 'cardTags', keys: ['cardId', 'tagId'] },
  { name: 'cardLinks', keys: ['fromCardId', 'toCardId'] },
  { name: 'journal', keys: ['date'] },
  { name: 'folders', keys: ['id'], lww: 'updatedAt' },
]

const specByName = new Map(TABLES.map((t) => [t.name, t]))

function getClientId(): string {
  const KEY = 'notebook-client-id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}

type Row = Record<string, unknown>

function keyOf(spec: TableSpec, row: Row): Record<string, string> {
  return Object.fromEntries(spec.keys.map((k) => [k, String(row[k])]))
}

function dexieKey(spec: TableSpec, key: Record<string, string>): string | string[] {
  return spec.keys.length === 1 ? key[spec.keys[0]] : spec.keys.map((k) => key[k])
}

class SyncEngine {
  private session: Session | null = null
  private clientId = ''
  private hooksRegistered = false
  private applyingRemote = false
  private pendingHookEntries: { table: string; op: 'upsert' | 'delete'; key: Record<string, string> }[] = []
  private hookFlushScheduled = false
  private flushing = false
  private channel: ReturnType<typeof supabase.channel> | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private notifyTimer: ReturnType<typeof setTimeout> | null = null

  /** app 啟動即呼叫：開始把本地變更記進 outbox（未登入也先累積） */
  registerHooks() {
    if (this.hooksRegistered) return
    this.hooksRegistered = true
    this.clientId = getClientId()
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const engine = this
    for (const spec of TABLES) {
      const table = db.table(spec.name)
      table.hook('creating', function (_, obj) {
        engine.queueFromHook(spec, 'upsert', obj as Row)
      })
      table.hook('updating', function (_, __, obj) {
        engine.queueFromHook(spec, 'upsert', obj as Row)
      })
      table.hook('deleting', function (_, obj) {
        engine.queueFromHook(spec, 'delete', obj as Row)
      })
    }
  }

  private queueFromHook(spec: TableSpec, op: 'upsert' | 'delete', row: Row) {
    if (this.applyingRemote) return
    this.pendingHookEntries.push({ table: spec.name, op, key: keyOf(spec, row) })
    if (this.hookFlushScheduled) return
    this.hookFlushScheduled = true
    // hook 在 Dexie 交易內執行，不能直接寫 outbox（不在交易範圍）；移到交易外
    setTimeout(() => {
      this.hookFlushScheduled = false
      const entries = this.pendingHookEntries.splice(0)
      void db.outbox
        .bulkAdd(entries.map((e) => ({ table: e.table, op: e.op, key: e.key })))
        .then(() => this.flush())
    }, 0)
  }

  async start(session: Session) {
    this.session = session
    this.registerHooks()
    window.addEventListener('online', this.onOnline)
    this.timer ??= setInterval(() => void this.flush(), 30_000)
    await this.initialSync()
    this.subscribeRealtime()
    await this.flush()
  }

  stop() {
    this.session = null
    window.removeEventListener('online', this.onOnline)
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.channel) void supabase.removeChannel(this.channel)
    this.channel = null
  }

  private onOnline = () => void this.flush()

  /** 首次/每次登入：拉全部資料合併進本地，再補傳遠端沒有的本地列 */
  private async initialSync() {
    const pending = await db.outbox.toArray()
    const pendingKeys = new Set(pending.map((p) => `${p.table}:${JSON.stringify(p.key)}`))

    for (const spec of TABLES) {
      const { data, error } = await supabase.from(spec.name).select('*')
      if (error) {
        console.warn(`[sync] pull ${spec.name} 失敗：`, error.message)
        continue
      }
      const table = db.table(spec.name)
      const remoteKeys = new Set<string>()
      this.applyingRemote = true
      try {
        for (const raw of (data ?? []) as Row[]) {
          const row = { ...raw }
          delete row.user_id
          delete row.client_id
          const key = keyOf(spec, row)
          remoteKeys.add(JSON.stringify(key))
          if (pendingKeys.has(`${spec.name}:${JSON.stringify(key)}`)) continue // 本地有未推送修改
          if (spec.lww) {
            const local = (await table.get(dexieKey(spec, key))) as Row | undefined
            if (local && Number(local[spec.lww]) > Number(row[spec.lww])) continue
          }
          await table.put(row)
        }
      } finally {
        this.applyingRemote = false
      }
      // 本地有、遠端沒有 → 補傳（含第一次登入時的既有離線資料）
      const locals = (await table.toArray()) as Row[]
      const missing = locals.filter((row) => !remoteKeys.has(JSON.stringify(keyOf(spec, row))))
      if (missing.length > 0) {
        await db.outbox.bulkAdd(
          missing.map((row) => ({ table: spec.name, op: 'upsert' as const, key: keyOf(spec, row) })),
        )
      }
    }
    this.notifyStores()
  }

  /** 依序把 outbox 推上 Supabase；失敗即停，之後重試 */
  private async flush() {
    if (this.flushing || !this.session || !navigator.onLine) return
    this.flushing = true
    try {
      // 一次取快照逐筆處理：某一筆失敗（例如某張表還沒跑遷移、缺欄位）只留下它自己，
      // 其餘照推，避免單一壞掉的變更卡住整個佇列。
      const entries = await db.outbox.orderBy('seq').toArray()
      let firstError: string | null = null
      for (const entry of entries) {
        const spec = specByName.get(entry.table)
        if (!spec) {
          await db.outbox.delete(entry.seq!)
          continue
        }
        try {
          if (entry.op === 'delete') {
            const { error } = await supabase.from(spec.name).delete().match(entry.key)
            if (error) throw error
          } else {
            const row = (await db.table(spec.name).get(dexieKey(spec, entry.key))) as Row | undefined
            if (row) {
              const payload = { ...row, user_id: this.session.user.id, client_id: this.clientId }
              const { error } = await supabase.from(spec.name).upsert(payload, {
                onConflict: spec.keys.length === 1 ? spec.keys[0] : `user_id,${spec.keys.join(',')}`,
              })
              if (error) throw error
            }
          }
          await db.outbox.delete(entry.seq!)
        } catch (err) {
          // 保留此筆，下次再試（30 秒後或重新上線時）
          if (!firstError) firstError = `${entry.table}: ${(err as Error).message}`
        }
      }
      if (firstError) console.warn('[sync] 部分變更稍後重試：', firstError)
    } finally {
      this.flushing = false
    }
  }

  private subscribeRealtime() {
    if (this.channel) return
    this.channel = supabase
      .channel('notebook-sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        void this.applyRealtime(payload)
      })
      .subscribe()
  }

  private async applyRealtime(payload: RealtimePostgresChangesPayload<Row>) {
    const spec = specByName.get(payload.table)
    if (!spec) return
    const table = db.table(spec.name)
    this.applyingRemote = true
    try {
      if (payload.eventType === 'DELETE') {
        const old = payload.old as Row
        if (old.client_id === this.clientId) return
        await table.delete(dexieKey(spec, keyOf(spec, old)))
      } else {
        const row = { ...(payload.new as Row) }
        if (row.client_id === this.clientId) return
        delete row.user_id
        delete row.client_id
        if (spec.lww) {
          const local = (await table.get(dexieKey(spec, keyOf(spec, row)))) as Row | undefined
          if (local && Number(local[spec.lww]) > Number(row[spec.lww])) return
        }
        await table.put(row)
      }
    } finally {
      this.applyingRemote = false
    }
    this.notifyStores()
  }

  /** 遠端變更套用後，讓各 store 重新載入（debounce 合併連續事件） */
  private notifyStores() {
    if (this.notifyTimer) clearTimeout(this.notifyTimer)
    this.notifyTimer = setTimeout(() => {
      void useCardStore.getState().load()
      void useWhiteboardStore.getState().load()
      void useTagStore.getState().load()
      void useJournalStore.getState().load()
      void useFolderStore.getState().load()
      void useBoardNotesStore.getState().load()
    }, 300)
  }
}

export const syncEngine = new SyncEngine()
