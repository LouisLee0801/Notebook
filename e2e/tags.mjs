// 標籤相關 5 項需求的迴歸測試（需先啟動 dev server：npm run dev）
//
// #1 標籤可搜尋（Cmd+K 與卡片標籤面板；也能用標籤找卡片）
// #2 白板上的卡片收合時仍顯示所有標籤
// #3 白板圖示改成 ▦，與資料夾 📁 區隔
// #4 卡片標籤可一次多選、可拖曳調整順序
// #5 從標籤點進卡片後，可用返回鍵／瀏覽器上一頁回到標籤
//
// 註：HTML5 拖放事件要分批 dispatch（中間留 ~60ms），
// 否則 React 的狀態更新還沒套用，會測到「拖了沒反應」的假失敗。
import { chromium } from 'playwright'

const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'

const browser = await chromium.launch({ executablePath: CHROMIUM })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? '' : undefined))
const log = (m) => console.log('✓', m)
const fail = (m) => {
  throw new Error(m)
}

await page.goto(BASE_URL)
await page.click('text=先離線使用'); await page.waitForSelector('text=卡片庫')

// 建一張卡片並加三個標籤
await page.click('[aria-label="新增卡片"]')
await page.waitForSelector('.title-input')
await page.locator('.title-input').first().click()
await page.keyboard.type('口袋證券HVDC介紹')
await page.waitForTimeout(400)

await page.click('[aria-label="加入標籤"]')
await page.waitForSelector('.tag-picker')
for (const name of ['投資', '筆記', '待辦']) {
  await page.fill('.tag-picker-search', name)
  await page.waitForTimeout(250)
  await page.click('.tag-picker-item.is-create')
  await page.waitForTimeout(400)
}
log('#4 標籤面板可連續加多個標籤（不會加一個就關閉）')
if (!(await page.locator('.tag-picker').count())) fail('#4 加完標籤面板就關了')

// #1 面板內搜尋
await page.fill('.tag-picker-search', '筆')
await page.waitForTimeout(300)
const searchHits = await page.locator('.tag-picker-item:not(.is-create) .tag-picker-chip').allTextContents()
log(`#1 標籤面板可搜尋：輸入「筆」→ ${searchHits.join(' ')}`)
if (searchHits.length !== 1 || !searchHits[0].includes('筆記')) fail('#1 標籤面板搜尋不正確')

// #4 多選：點擊已勾選的可移除、再點回來
await page.fill('.tag-picker-search', '')
await page.waitForTimeout(250)
const checkedBefore = await page.locator('.tag-picker-item.is-checked').count()
log(`#4 面板顯示已掛上的 ${checkedBefore} 個標籤（可再點擊取消）`)
if (checkedBefore !== 3) fail(`#4 應有 3 個已勾選，實際 ${checkedBefore}`)
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

let chips = await page.locator('.mt-2 span.group button:first-child').allTextContents()
if (chips.join() !== '#投資,#筆記,#待辦') fail('標籤初始順序不對: ' + chips)

// #4 拖曳排序：把第一個拖到第三個位置
const dragged = await page.evaluate(async () => {
  const chips = [...document.querySelectorAll('span.group')].filter(s => s.textContent.startsWith('#'))
  if (chips.length < 3) return 'not enough chips: ' + chips.length
  const dt = new DataTransfer()
  const tick = () => new Promise(r => setTimeout(r, 60))
  chips[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))
  await tick()
  chips[2].dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }))
  await tick()
  chips[2].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
  return 'ok'
})
await page.waitForTimeout(600)
chips = await page.locator('.mt-2 span.group button:first-child').allTextContents()
log(`#4 拖曳可調整標籤順序：${chips.join(' ')}`)
if (chips.join() !== '#筆記,#待辦,#投資') fail('#4 拖曳排序沒生效: ' + chips)

// 重新整理後順序保留
await page.reload(); await page.waitForTimeout(1200)
if (await page.locator('text=先離線使用').count()) await page.click('text=先離線使用')
await page.waitForSelector('text=卡片庫')
await page.locator('aside li button', { hasText: '口袋證券' }).first().click()
await page.waitForTimeout(800)
chips = await page.locator('.mt-2 span.group button:first-child').allTextContents()
log(`#4 重新整理後順序保留：${chips.join(' ')}`)
if (chips.join() !== '#筆記,#待辦,#投資') fail('#4 排序沒寫進資料庫: ' + chips)

// #1 Cmd+K 搜尋標籤
await page.keyboard.press('Control+k')
await page.waitForTimeout(300)
await page.keyboard.type('投資')
await page.waitForTimeout(500)
const kinds = await page.locator('.fixed ul li button span:first-child').allTextContents()
const titles = await page.locator('.fixed ul li button span:nth-child(2)').allTextContents()
log(`#1 Cmd+K 可搜尋標籤、也能用標籤找卡片：${kinds.map((k, i) => `${k}=${titles[i]}`).slice(0, 3).join('、')}`)
if (!kinds.includes('標籤')) fail('#1 Cmd+K 沒有標籤結果')
if (!titles.some(t => t.includes('口袋證券'))) fail('#1 Cmd+K 沒有用標籤找到卡片')
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// #5 從標籤頁點進卡片，上一頁回到標籤
await page.locator('aside').getByText('投資', { exact: false }).first().click()
await page.waitForTimeout(600)
const onTagPage = await page.locator('main').textContent()
await page.locator('main a, main button').filter({ hasText: '口袋證券' }).first().click()
await page.waitForTimeout(700)
const onCard = await page.locator('.title-input').first().textContent()
if (!onCard.includes('口袋證券')) fail('#5 沒有進到卡片頁')

const backBtn = page.locator('[aria-label="上一頁"]')

if (!(await backBtn.isEnabled())) fail('#5 返回鍵沒有啟用')
await backBtn.click()
await page.waitForTimeout(700)
const backTo = await page.locator('main').textContent()
log('#5 從標籤點進卡片後，返回鍵可回到標籤頁')
if (!backTo.includes('投資')) fail('#5 上一頁沒回到標籤頁')

// 瀏覽器上一頁也要能用
await page.locator('main a, main button').filter({ hasText: '口袋證券' }).first().click()
await page.waitForTimeout(600)
await page.goBack()
await page.waitForTimeout(700)
const afterBrowserBack = await page.locator('main').textContent()
log('#5 瀏覽器／手機的上一頁也能回到標籤頁')
if (!afterBrowserBack.includes('投資')) fail('#5 瀏覽器上一頁沒回到標籤頁')


// ---- #2 / #3 白板上的標籤與圖示 ----
await page.click('[aria-label="新增卡片"]')
await page.waitForSelector('.title-input')
await page.locator('.title-input').first().click()
await page.keyboard.type('HVDC 研究')
await page.waitForTimeout(400)
await page.click('[aria-label="加入標籤"]')
await page.waitForSelector('.tag-picker')
for (const name of ['長期', '硬體']) {
  await page.fill('.tag-picker-search', name)
  await page.waitForTimeout(250)
  await page.click('.tag-picker-item.is-create')
  await page.waitForTimeout(400)
}
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// #3 白板圖示
await page.click('[aria-label="新增白板"]')
await page.waitForSelector('.react-flow')
await page.waitForTimeout(600)
const icon = await page.locator('.board-icon').first().textContent()
log(`#3 白板圖示改為「${icon}」，與資料夾 📁 明顯不同`)
if (icon === '🗂') fail('#3 圖示沒換')
if (!icon || icon === '📁') fail('#3 圖示與資料夾重複')

// 把卡片拖上白板
const dropped = await page.evaluate(() => {
  const src = [...document.querySelectorAll('aside li button')].find(b => b.textContent.includes('HVDC 研究'))
  const pane = document.querySelector('.react-flow__pane')
  if (!src || !pane) return false
  const dt = new DataTransfer()
  src.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))
  const opts = { dataTransfer: dt, bubbles: true, cancelable: true, clientX: 700, clientY: 400 }
  pane.dispatchEvent(new DragEvent('dragover', opts))
  pane.dispatchEvent(new DragEvent('drop', opts))
  return true
})
await page.waitForTimeout(900)
const nodeCount = await page.locator('.react-flow__node-card').count()
if (nodeCount === 0) fail('卡片沒上板')

// #2 展開狀態就有標籤
let tags = await page.locator('.card-node-tag').allTextContents()
log(`#2 白板卡片展開時顯示標籤：${tags.join(' ')}`)
if (tags.length !== 2) fail(`#2 展開時標籤數應為 2，實際 ${tags.length}`)

// #2 收合後仍顯示全部標籤
await page.locator('[aria-label="收合卡片"]').first().click()
await page.waitForTimeout(600)
tags = await page.locator('.card-node-tag').allTextContents()
const bodyVisible = await page.locator('.card-node-body').count()
log(`#2 收合後仍顯示全部標籤：${tags.join(' ')}（內文已收起）`)
if (tags.length !== 2) fail(`#2 收合後標籤數應為 2，實際 ${tags.length}`)
if (bodyVisible !== 0) fail('#2 收合後內文沒有隱藏')


console.log('\nALL TAG CHECKS PASSED')
await browser.close()
