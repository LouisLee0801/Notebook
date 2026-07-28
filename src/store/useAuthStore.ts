import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase, syncConfigured } from '../sync/supabaseClient'
import { syncEngine } from '../sync/syncEngine'

const SKIP_KEY = 'notebook-sync-skipped'

interface AuthStore {
  ready: boolean
  session: Session | null
  skipped: boolean
  recovering: boolean // 使用者點了重設密碼信的連結，需設定新密碼
  error: string | null
  notice: string | null
  init: () => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ ok: boolean; message: string }>
  changePassword: (newPassword: string) => Promise<{ ok: boolean; message: string }>
  finishRecovery: () => void
  skip: () => void
  unskip: () => void
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  ready: !syncConfigured,
  session: null,
  skipped: localStorage.getItem(SKIP_KEY) === '1',
  recovering: false,
  error: null,
  notice: null,

  init: () => {
    if (!syncConfigured) return
    void supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, ready: true })
      if (data.session) void syncEngine.start(data.session)
    })
    supabase.auth.onAuthStateChange((event, session) => {
      const prev = get().session
      set({ session })
      // 點了重設密碼信連結 → 進入設定新密碼流程
      if (event === 'PASSWORD_RECOVERY') set({ recovering: true, error: null, notice: null })
      if (session && !prev) void syncEngine.start(session)
      if (!session && prev) syncEngine.stop()
      if (event === 'SIGNED_OUT') set({ notice: null, error: null })
    })
  },

  signIn: async (email, password) => {
    set({ error: null, notice: null })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) set({ error: error.message })
  },

  signUp: async (email, password) => {
    set({ error: null, notice: null })
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      set({ error: error.message })
      return
    }
    if (!data.session) {
      set({ notice: '確認信已寄出，請到信箱點擊連結完成註冊後再登入。' })
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
  },

  resetPassword: async (email) => {
    if (!email.trim()) return { ok: false, message: '請先輸入 Email' }
    // 重設連結導回本 App（GitHub Pages 子路徑），點擊後觸發 PASSWORD_RECOVERY
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    if (error) return { ok: false, message: error.message }
    return { ok: true, message: '重設密碼信已寄出，請到信箱點擊連結後設定新密碼。' }
  },

  changePassword: async (newPassword) => {
    if (newPassword.length < 6) return { ok: false, message: '密碼至少需要 6 個字元' }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { ok: false, message: error.message }
    return { ok: true, message: '密碼已更新' }
  },

  finishRecovery: () => set({ recovering: false }),

  skip: () => {
    localStorage.setItem(SKIP_KEY, '1')
    set({ skipped: true })
  },

  unskip: () => {
    localStorage.removeItem(SKIP_KEY)
    set({ skipped: false })
  },
}))
