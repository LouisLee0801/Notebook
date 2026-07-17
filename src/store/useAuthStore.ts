import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase, syncConfigured } from '../sync/supabaseClient'
import { syncEngine } from '../sync/syncEngine'

const SKIP_KEY = 'notebook-sync-skipped'

interface AuthStore {
  ready: boolean
  session: Session | null
  skipped: boolean
  error: string | null
  notice: string | null
  init: () => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  skip: () => void
  unskip: () => void
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  ready: !syncConfigured,
  session: null,
  skipped: localStorage.getItem(SKIP_KEY) === '1',
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

  skip: () => {
    localStorage.setItem(SKIP_KEY, '1')
    set({ skipped: true })
  },

  unskip: () => {
    localStorage.removeItem(SKIP_KEY)
    set({ skipped: false })
  },
}))
