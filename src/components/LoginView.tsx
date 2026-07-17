import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'

// 登入頁（M0：Supabase Auth，Email + 密碼）
export function LoginView() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const error = useAuthStore((s) => s.error)
  const notice = useAuthStore((s) => s.notice)
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const skip = useAuthStore((s) => s.skip)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'signIn') await signIn(email, password)
      else await signUp(email, password)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Notebook</h1>
        <p className="mt-1 text-sm text-gray-500">登入後筆記會同步到雲端，任何電腦都能使用</p>

        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密碼（至少 6 碼）"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          {notice && <p className="text-xs text-emerald-600">{notice}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {busy ? '處理中…' : mode === 'signIn' ? '登入' : '註冊'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
            className="text-gray-500 hover:text-gray-800"
          >
            {mode === 'signIn' ? '沒有帳號？註冊' : '已有帳號？登入'}
          </button>
          <button type="button" onClick={skip} className="text-gray-400 hover:text-gray-600">
            先離線使用 →
          </button>
        </div>
      </div>
    </div>
  )
}
