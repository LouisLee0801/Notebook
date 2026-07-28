import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'

// 點了重設密碼信連結後的落地頁（#2）：設定新密碼
export function RecoveryView() {
  const changePassword = useAuthStore((s) => s.changePassword)
  const finishRecovery = useAuthStore((s) => s.finishRecovery)
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (pw1 !== pw2) {
      setMsg({ ok: false, text: '兩次輸入的新密碼不一致' })
      return
    }
    setBusy(true)
    const res = await changePassword(pw1)
    setBusy(false)
    setMsg({ ok: res.ok, text: res.message })
    if (res.ok) setTimeout(() => finishRecovery(), 800)
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">設定新密碼</h1>
        <p className="mt-1 text-sm text-gray-500">請輸入你的新密碼</p>
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-3">
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            placeholder="新密碼（至少 6 碼）"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="再次輸入新密碼"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
          />
          {msg && (
            <p className={`text-xs ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{msg.text}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {busy ? '更新中…' : '設定新密碼並繼續'}
          </button>
        </form>
        <button
          type="button"
          onClick={finishRecovery}
          className="mt-4 text-xs text-gray-400 hover:text-gray-600"
        >
          略過，直接進入
        </button>
      </div>
    </div>
  )
}
