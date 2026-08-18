// 超連結網址正規化（#5）
//
// 使用者常直接打 example.com 或貼上 email，這裡補上通訊協定，
// 否則瀏覽器會把它當成相對路徑，點了跳不到目的網站。
export function normalizeUrl(input: string): string {
  const url = input.trim()
  if (!url) return ''
  if (/^(https?|mailto|tel):/i.test(url)) return url
  if (/^[\w.-]+@[\w.-]+\.\w+$/.test(url)) return `mailto:${url}`
  return `https://${url}`
}
