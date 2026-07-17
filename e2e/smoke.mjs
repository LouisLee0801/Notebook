// 核心 happy path 冒煙測試（需先啟動 dev server：npm run dev）
// 涵蓋 M1（建卡→編輯→持久化→刪除）與 M2（白板、上板、一卡兩板同步）
import { chromium } from 'playwright'

const CHROMIUM =
  process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'

const browser = await chromium.launch({ executablePath: CHROMIUM })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const log = (m) => console.log('✓', m)
page.on('dialog', (d) => d.accept())

await page.goto(BASE_URL)
await page.waitForSelector('text=卡片庫')
log('app loaded')

// ---- M1：卡片 + 編輯器 ----
await page.click('[aria-label="新增卡片"]')
await page.waitForSelector('input[placeholder="未命名卡片"]')
await page.fill('input[placeholder="未命名卡片"]', '我的第一張卡片')
await page.click('.tiptap')
await page.keyboard.type('這是內文。')
await page.keyboard.press('Enter')
await page.keyboard.type('/標題')
await page.waitForSelector('.slash-menu-item')
await page.keyboard.press('Enter')
await page.keyboard.type('章節一')
if ((await page.textContent('.tiptap h1')) !== '章節一') throw new Error('slash menu failed')
log('M1: card + editor + slash menu')

await page.keyboard.press('Enter')
await page.keyboard.type('- 清單項目')
if (!(await page.textContent('.tiptap ul li'))?.includes('清單項目'))
  throw new Error('markdown shortcut failed')
log('M1: markdown input rules')

await page.waitForTimeout(800)
await page.reload()
await page.waitForSelector('text=我的第一張卡片')
await page.click('text=我的第一張卡片')
await page.waitForSelector('.tiptap')
const body = await page.textContent('.tiptap')
if (!body.includes('這是內文') || !body.includes('章節一')) throw new Error('persistence failed')
log('M1: reload persistence')

// ---- M2：白板 ----
await page.click('[aria-label="新增白板"]')
await page.waitForSelector('.react-flow__pane')
log('M2: whiteboard created and opened')

// 雙擊空白處新增卡片（會開啟右側編輯抽屜）
await page.dblclick('.react-flow__pane', { position: { x: 500, y: 300 } })
await page.waitForSelector('text=編輯卡片')
await page.fill('input[placeholder="未命名卡片"]', '白板上的卡片')
await page.waitForSelector('.card-node-title:has-text("白板上的卡片")')
log('M2: dblclick creates card, drawer edit syncs to node')
await page.click('[aria-label="關閉編輯"]')

// 建第二個白板，從側邊欄拖同一張卡片上板（一卡多板）
await page.click('[aria-label="新增白板"]')
await page.waitForSelector('.react-flow__pane')
const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
await page.dispatchEvent('aside >> text=白板上的卡片', 'dragstart', { dataTransfer })
await page.dispatchEvent('.react-flow__pane', 'drop', {
  dataTransfer,
  clientX: 700,
  clientY: 400,
})
await page.waitForSelector('.card-node-title:has-text("白板上的卡片")')
log('M2: drag existing card from library onto board 2')

// 在板 2 編輯卡片，回到板 1 應同步（內容單一來源）
await page.dblclick('.card-node')
await page.waitForSelector('text=編輯卡片')
await page.fill('input[placeholder="未命名卡片"]', '同步後的標題')
await page.waitForTimeout(600)
await page.click('aside >> text=白板 1')
await page.waitForSelector('.card-node-title:has-text("同步後的標題")')
log('M2: edit on board 2 syncs to board 1 (single source of truth)')

// 白板持久化：重新整理後節點還在
await page.reload()
await page.waitForSelector('aside >> text=白板 1')
await page.click('aside >> text=白板 1')
await page.waitForSelector('.card-node-title:has-text("同步後的標題")')
log('M2: board persists after reload')

// ---- M3：日誌 + 雙向連結 ----
await page.click('aside >> text=日誌')
await page.waitForSelector('text=今天')
log('M3: journal opens with today entry')

await page.click('.journal-editor .tiptap')
await page.keyboard.type('參考 [[我的第一')
await page.waitForSelector('.slash-menu-item')
await page.keyboard.press('Enter')
await page.waitForSelector('.journal-editor .card-link:has-text("我的第一張卡片")')
log('M3: [[ suggestion inserts card link in journal')

await page.waitForTimeout(800)
await page.click('aside >> text=我的第一張卡片')
await page.waitForSelector('text=反向連結')
await page.waitForSelector('button:has-text("日誌")')
log('M3: backlinks panel shows the journal entry (acceptance)')

// 點反向連結面板無法直達日誌卡（開在卡片視圖），改驗證 chip 點擊導航
await page.click('aside >> text=日誌')
await page.waitForSelector('.journal-editor .card-link')
await page.click('.journal-editor .card-link')
await page.waitForSelector('input[placeholder="未命名卡片"]')
log('M3: clicking a card link navigates to the card')

// ---- 清理 ----
await page.click('aside >> text=卡片庫')
while (await page.$('[aria-label="刪除白板"]')) {
  await page.hover('aside li:has([aria-label="刪除白板"])')
  await page.click('[aria-label="刪除白板"]')
  await page.waitForTimeout(200)
}
while (await page.$('[aria-label="刪除卡片"]')) {
  await page.hover('aside li:has([aria-label="刪除卡片"])')
  await page.click('[aria-label="刪除卡片"]')
  await page.waitForTimeout(200)
}
log('cleanup done')

await browser.close()
console.log('ALL E2E CHECKS PASSED')
