// 標題格式（#9）：標題的「純文字」仍存在 card.title（供搜尋、連結、白板顯示、同步），
// 而粗體/顏色/螢光等「格式」只是視覺層，存在本機 localStorage（不進雲端、不需資料庫遷移）。
// 換句話說：文字跨裝置同步，樣式屬於本機偏好。

const KEY = 'notebook-title-html'

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function getTitleHtml(id: string): string | null {
  try {
    return localStorage.getItem(`${KEY}:${id}`)
  } catch {
    return null
  }
}

/** 有實際格式才存；純文字（等同 <p>純文字</p>）或空白則清除 */
export function setTitleHtml(id: string, html: string, plain: string): void {
  try {
    const plainWrapped = `<p>${escapeHtml(plain)}</p>`
    if (!plain.trim() || html === plainWrapped || html === '<p></p>') {
      localStorage.removeItem(`${KEY}:${id}`)
    } else {
      localStorage.setItem(`${KEY}:${id}`, html)
    }
  } catch {
    /* 忽略（無痕模式等） */
  }
}

/** 給白板卡片節點用：有格式回傳 HTML，否則回傳 null（改用純文字） */
export function titleHtmlOrNull(id: string, plain: string): string | null {
  const html = getTitleHtml(id)
  if (!html || !plain.trim()) return null
  return html
}
