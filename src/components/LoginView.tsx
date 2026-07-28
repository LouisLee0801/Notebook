import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'

// 登入頁（M0：Supabase Auth，Email + 密碼）
export function LoginView() {
  const [mode, setMode] = useState<'signIn' | 'signUp' | 'forgot'>('signIn')
  const [codeSent, setCodeSent] = useState(false) // forgot 模式：已寄出驗證碼
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [newPw, setNewPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [localMsg, setLocalMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const error = useAuthStore((s) => s.error)
  const notice = useAuthStore((s) => s.notice)
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const resetPassword = useAuthStore((s) => s.resetPassword)
  const verifyRecoveryOtp = useAuthStore((s) => s.verifyRecoveryOtp)
  const skip = useAuthStore((s) => s.skip)

  const backToSignIn = () => {
    setMode('signIn')
    setCodeSent(false)
    setCode('')
    setNewPw('')
    setLocalMsg(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setLocalMsg(null)
    try {
      if (mode === 'signIn') await signIn(email, password)
      else if (mode === 'signUp') await signUp(email, password)
      else if (!codeSent) {
        const res = await resetPassword(email)
        setLocalMsg({ ok: res.ok, text: res.message })
        if (res.ok) setCodeSent(true)
      } else {
        const res = await verifyRecoveryOtp(email, code, newPw)
        setLocalMsg({ ok: res.ok, text: res.message })
        // 成功後 Supabase 會建立 session，App 會自動切到主畫面
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Notebook</h1>
        <p className="mt-1 text-sm text-gray-500">
          {mode === 'forgot'
            ? codeSent
              ? '輸入信中的 6 位數驗證碼與新密碼（若連結被公司防火牆擋住可用這個）'
              : '輸入註冊 Email，我們會寄送重設密碼信（含連結與驗證碼）'
            : '登入後筆記會同步到雲端，任何電腦都能使用'}
        </p>

        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
          />
          {mode !== 'forgot' && (
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密碼（至少 6 碼）"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
            />
          )}
          {mode === 'forgot' && codeSent && (
            <>
              <input
                type="text"
                inputMode="numeric"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="信中的驗證碼"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
              />
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="新密碼（至少 6 碼）"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
              />
            </>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          {notice && <p className="text-xs text-emerald-600">{notice}</p>}
          {localMsg && (
            <p className={`text-xs ${localMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
              {localMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {busy
              ? '處理中…'
              : mode === 'signIn'
                ? '登入'
                : mode === 'signUp'
                  ? '註冊'
                  : codeSent
                    ? '設定新密碼'
                    : '寄送重設信'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs">
          {mode === 'forgot' ? (
            <button type="button" onClick={backToSignIn} className="text-gray-500 hover:text-gray-800">
              ← 返回登入
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
                className="text-gray-500 hover:text-gray-800"
              >
                {mode === 'signIn' ? '沒有帳號？註冊' : '已有帳號？登入'}
              </button>
              {mode === 'signIn' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot')
                    setLocalMsg(null)
                  }}
                  className="text-gray-500 hover:text-gray-800"
                >
                  忘記密碼？
                </button>
              )}
            </div>
          )}
          <button type="button" onClick={skip} className="text-gray-400 hover:text-gray-600">
            先離線使用 →
          </button>
        </div>
      </div>
    </div>
  )
}
