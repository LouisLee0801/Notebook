// 收合狀態跨裝置保留的迴歸測試（需先啟動 dev server：npm run dev）
//
// 收合狀態原本存在瀏覽器 localStorage，換一台電腦就全部變回展開。
// 現在改存進資料庫（cardInstances.collapsed / folders.collapsed）跟著帳號同步。
//
// 驗證方式：操作完把 localStorage 整個清空再重新載入 —— 這等同換一台新電腦，
// 狀態若仍在，就證明它真的存在資料庫而不是瀏覽器。
import { chromium } from 'playwright'

const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'

const browser = await chromium.launch({ executablePath: CHROMIUM })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const log = (m) => console.log('✓', m)
const fail = (m) => {
  throw new Error(m)
}

let promptAnswer = '研究專案'
page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? promptAnswer : undefined))
await page.goto(BASE_URL)
await page.click('text=先離線使用'); await page.waitForSelector('text=卡片庫')

// --- 建白板 + 兩張卡片 ---
await page.click('[aria-label="新增白板"]')
await page.waitForSelector('.react-flow'); await page.waitForTimeout(600)
const pane = page.locator('.react-flow__pane')
const nodes = page.locator('.react-flow__node-card')
for (const [x, y, n] of [[250,200,'A'],[650,250,'B']]) {
  await pane.dblclick({ position: { x, y } })
  await page.waitForTimeout(600)
  await page.locator('.title-input').first().click()
  await page.keyboard.type('卡片' + n)
  await page.waitForTimeout(400)
  await page.locator('[aria-label="關閉編輯"]').click()
  await page.waitForTimeout(400)
}

// 收合第一張
await nodes.first().locator('[aria-label="收合卡片"]').click()
await page.waitForTimeout(600)
log('白板上收合一張卡片')

// --- 建資料夾並收合（卡片庫 + 白板各一）---
await page.click('[aria-label="新增白板資料夾"]')
await page.waitForTimeout(600)
await page.click(`[aria-label="收合白板資料夾 研究專案"]`)
await page.waitForTimeout(500)
promptAnswer = '參考資料'
await page.click('[aria-label="新增資料夾"]')
await page.waitForTimeout(600)
await page.click(`[aria-label="收合資料夾 參考資料"]`)
await page.waitForTimeout(500)
log('側邊欄收合白板資料夾與卡片資料夾各一個')

// --- 關鍵：清掉 localStorage，模擬「換一台電腦」---
const cleared = await page.evaluate(() => {
  const before = localStorage.length
  localStorage.clear()
  return before
})
log(`清空 localStorage（原有 ${cleared} 筆）＝模擬換一台新電腦`)

await page.reload()
await page.waitForTimeout(1300)
if (await page.locator('text=先離線使用').count()) await page.click('text=先離線使用')
await page.waitForSelector('text=卡片庫')
await page.waitForTimeout(600)

// 資料夾收合狀態應保留
const boardFolderCollapsed = await page.locator('[aria-label="展開白板資料夾 研究專案"]').count() === 1
const cardFolderCollapsed = await page.locator('[aria-label="展開資料夾 參考資料"]').count() === 1
log('換電腦後，兩個資料夾的收合狀態都還在')
if (!boardFolderCollapsed) fail('白板資料夾收合狀態沒保留')
if (!cardFolderCollapsed) fail('卡片資料夾收合狀態沒保留')

// 回到白板看卡片收合狀態
await page.locator('aside li button').filter({ hasText: '白板' }).first().click()
await page.waitForSelector('.react-flow')
await page.waitForTimeout(1200)
const collapsedCount = await page.locator('[aria-label="展開卡片"]').count()
const expandedCount = await page.locator('[aria-label="收合卡片"]').count()
log('換電腦後，卡片的收合狀態也還在（1 收合 / 1 展開）')
if (collapsedCount !== 1) fail(`卡片收合狀態沒保留（收合數 ${collapsedCount}，應為 1）`)
if (expandedCount !== 1) fail(`展開的卡片數不對（${expandedCount}，應為 1）`)

// 展開後也要能存回去
await page.locator('[aria-label="展開卡片"]').first().click()
await page.waitForTimeout(600)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(1300)
if (await page.locator('text=先離線使用').count()) await page.click('text=先離線使用')
await page.waitForSelector('text=卡片庫')
await page.locator('aside li button').filter({ hasText: '白板' }).first().click()
await page.waitForSelector('.react-flow')
await page.waitForTimeout(1200)
const afterExpand = await page.locator('[aria-label="展開卡片"]').count()
log('把卡片展開後同樣會存回資料庫')
if (afterExpand !== 0) fail('展開狀態沒有存回資料庫')


// ---- 改版前的舊資料要能沿用 ----
await page.goto(BASE_URL)
if (await page.locator('text=先離線使用').count()) await page.click('text=先離線使用')
await page.waitForSelector('text=卡片庫')
await page.click('[aria-label="新增白板"]')
await page.waitForSelector('.react-flow'); await page.waitForTimeout(600)
await page.locator('.react-flow__pane').dblclick({ position: { x: 300, y: 220 } })
await page.waitForTimeout(700)
await page.locator('.title-input').first().click()
await page.keyboard.type('舊卡片')
await page.waitForTimeout(500)
await page.locator('[aria-label="關閉編輯"]').click()
await page.waitForTimeout(500)


// 把資料庫還原成「改版前」的樣子：拿掉 collapsed 欄位，改用舊版的 localStorage 記號
const seeded = await page.evaluate(async () => {
  const openDb = () => new Promise((res, rej) => {
    const r = indexedDB.open('notebook')
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
  })
  const db = await openDb()
  const getAll = (name) =>
    new Promise((res) => {
      const q = db.transaction(name, 'readonly').objectStore(name).getAll()
      q.onsuccess = () => res(q.result)
    })
  // 只動「剛建立的那個白板」上的卡片，避免改到前面測試留下的卡片
  const boards = await getAll('whiteboards')
  const newest = boards.sort((a, b) => b.createdAt - a.createdAt)[0]
  const instances = await getAll('cardInstances')
  const row = instances.find((i) => i.whiteboardId === newest?.id)
  if (!row) return 'no instance'

  delete row.collapsed                                  // 改版前沒有這個欄位
  const tx = db.transaction('cardInstances', 'readwrite')
  tx.objectStore('cardInstances').put(row)
  await new Promise((res) => { tx.oncomplete = res })
  localStorage.setItem(`notebook-card-collapsed:${row.id}`, '1')  // 舊版的收合記號
  return row.id
})
log(`把資料庫還原成改版前的樣子（${String(seeded).slice(0, 8)}…）`)

await page.reload()
await page.waitForTimeout(1300)
if (await page.locator('text=先離線使用').count()) await page.click('text=先離線使用')
await page.waitForSelector('text=卡片庫')
await page.locator('aside li button').filter({ hasText: '白板' }).first().click()
await page.waitForSelector('.react-flow')
await page.waitForTimeout(1300)

if ((await page.locator('.react-flow__node-card').count()) !== 1)
  fail('測試前提有誤：這個白板上應該只有一張卡片')
if ((await page.locator('[aria-label="展開卡片"]').count()) !== 1)
  fail('沒有沿用改版前的收合狀態')
log('改版前存在瀏覽器的收合狀態，開啟白板時被沿用')

// 應已寫進資料庫，且清掉 localStorage 殘留
const after = await page.evaluate(async (id) => {
  const db = await new Promise((res) => { const r = indexedDB.open('notebook'); r.onsuccess = () => res(r.result) })
  const store = db.transaction('cardInstances', 'readonly').objectStore('cardInstances')
  const row = await new Promise((res) => { const q = store.get(id); q.onsuccess = () => res(q.result) })
  return {
    collapsed: row?.collapsed,
    legacyLeft: Object.keys(localStorage).filter((k) => k.startsWith('notebook-card-collapsed')).length,
  }
}, seeded)
if (after.collapsed !== true) fail('沒有寫進資料庫')
if (after.legacyLeft !== 0) fail('localStorage 殘留沒清掉')
log('舊狀態已寫進資料庫，localStorage 殘留也清乾淨')


console.log('\nALL COLLAPSE CHECKS PASSED')
await browser.close()
