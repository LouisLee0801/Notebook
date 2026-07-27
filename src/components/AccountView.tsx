import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { syncConfigured } from '../sync/supabaseClient'

function formatDate(ts?: string): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-TW', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 帳號管理（#5 更改密碼、#6 帳號管理介面）
export function AccountView() {
  const session = useAuthStore((s) => s.session)
  const signOut = useAuthStore((s) => s.signOut)
  const changePassword = useAuthStore((s) => s.changePassword)
  const unskip = useAuthStore((s) => s.unskip)

  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const submitPassword = async () => {
    setMsg(null)
    if (pw1 !== pw2) {
      setMsg({ ok: false, text: '兩次輸入的新密碼不一致' })
      return
    }
    setBusy(true)
    const res = await changePassword(pw1)
    setBusy(false)
    setMsg({ ok: res.ok, text: res.message })
    if (res.ok) {
      setPw1('')
      setPw2('')
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-8 py-10">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">帳號管理</h1>

        {!syncConfigured && (
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
            目前未設定雲端同步，資料只存在本機。
          </p>
        )}

        {syncConfigured && !session && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600">
            <p className="mb-3">你目前在離線模式，尚未登入。登入後資料才會跨裝置同步。</p>
            <button
              type="button"
              onClick={unskip}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
            >
              前往登入 / 註冊
            </button>
          </div>
        )}

        {session && (
          <>
            {/* 帳號資訊 */}
            <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-500">帳號資訊</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Email</dt>
                  <dd className="truncate font-medium text-gray-800">{session.user.email}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">使用者 ID</dt>
                  <dd className="truncate font-mono text-xs text-gray-500">{session.user.id}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">註冊時間</dt>
                  <dd className="text-gray-700">{formatDate(session.user.created_at)}</dd>
                </div>
              </dl>
            </section>

            {/* 更改密碼 (#5) */}
            <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-500">更改密碼</h2>
              <div className="space-y-3">
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="新密碼（至少 6 字元）"
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="再次輸入新密碼"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={busy || !pw1 || !pw2}
                    onClick={() => void submitPassword()}
                    className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
                  >
                    {busy ? '更新中…' : '更新密碼'}
                  </button>
                  {msg && (
                    <span className={`text-sm ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>
                      {msg.text}
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* 登出 */}
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-500">登入狀態</h2>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                登出
              </button>
            </section>

            <p className="mt-6 text-xs leading-relaxed text-gray-400">
              註：本 App 為個人單一帳號使用，每個帳號各自登入、只看得到自己的資料（由資料庫的
              Row Level Security 隔離）。如需「多位使用者、由你統一開帳號 / 停用」的後台，
              需要另建具管理權限的伺服器端服務，無法只在前端安全達成——若你要，我可以再幫你規劃。
            </p>
          </>
        )}
      </div>
    </div>
  )
}
