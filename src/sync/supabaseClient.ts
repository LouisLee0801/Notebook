import { createClient } from '@supabase/supabase-js'

// publishable key 本來就是設計成可放進前端的公開金鑰，
// 資料安全由資料庫端的 Row Level Security 把關（見 supabase/schema.sql）。
export const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  'https://bbnqyhzhyfeajcbxvewz.supabase.co'

export const SUPABASE_KEY: string =
  (import.meta.env.VITE_SUPABASE_KEY as string | undefined) ??
  'sb_publishable_oVq8rwnpTlE7zq0ryybZVg_4ghM8LaT'

export const syncConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY)

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
