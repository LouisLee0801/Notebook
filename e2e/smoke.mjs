import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage()
const log = (m) => console.log('✓', m)

await page.goto('http://localhost:5173')
await page.waitForSelector('text=卡片庫')
log('app loaded, 卡片庫 visible')

// 建立卡片
await page.click('text=＋ 新增卡片')
await page.waitForSelector('input[placeholder="未命名卡片"]')
log('card created, editor open')

// 輸入標題與內容
await page.fill('input[placeholder="未命名卡片"]', '我的第一張卡片')
await page.click('.tiptap')
await page.keyboard.type('這是內文。')
log('typed title + body')

// slash 選單
await page.keyboard.press('Enter')
await page.keyboard.type('/標題')
await page.waitForSelector('.slash-menu-item')
await page.keyboard.press('Enter')
await page.keyboard.type('章節一')
const h1 = await page.textContent('.tiptap h1')
if (h1 !== '章節一') throw new Error('slash menu heading failed: ' + h1)
log('slash menu -> H1 works')

// markdown 快捷：- 轉清單
await page.keyboard.press('Enter')
await page.keyboard.type('- 清單項目')
const li = await page.textContent('.tiptap ul li')
if (!li?.includes('清單項目')) throw new Error('markdown shortcut failed')
log('markdown "-" -> bullet list works')

// 等 debounce 儲存後重新整理，驗證持久化
await page.waitForTimeout(800)
await page.reload()
await page.waitForSelector('text=我的第一張卡片')
await page.click('text=我的第一張卡片')
await page.waitForSelector('.tiptap')
const body = await page.textContent('.tiptap')
if (!body.includes('這是內文') || !body.includes('章節一')) throw new Error('persistence failed: ' + body)
log('reload -> data persisted (IndexedDB)')

// 刪除卡片
page.on('dialog', (d) => d.accept())
await page.hover('text=我的第一張卡片')
await page.click('[aria-label="刪除卡片"]')
await page.waitForSelector('text=還沒有卡片', { timeout: 3000 })
log('soft delete works, library empty')

await browser.close()
console.log('ALL E2E CHECKS PASSED')
