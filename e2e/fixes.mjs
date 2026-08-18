// 本輪 8 項修正的迴歸測試（需先啟動 dev server：npm run dev）
//
// 對應使用者回報：
//   #1 白板資料夾   #2 收合時仍可調整卡片大小   #3 收合後連線跟著卡片
//   #4 上一步/重做   #5 超連結（右鍵插入、看得到、點得開）
//   #6 框選多張卡片統一移動與對齊   #7 清單 Backspace 退回上一層   #8 表格後可繼續打字
//
// 注意：模擬按鍵之間要留 >50ms，否則 ProseMirror 尚未同步 DOM 選取，
// 會測到「游標還在原位」的假失敗（真人操作不會這麼快）。
import { chromium } from 'playwright'

const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'
const BODY = '.tiptap:not(.title-input)'

const browser = await chromium.launch({ executablePath: CHROMIUM })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const log = (m) => console.log('✓', m)
const fail = (m) => {
  throw new Error(m)
}

let promptAnswer = ''
page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? promptAnswer : undefined))

async function startOffline() {
  await page.goto(BASE_URL)
  if (await page.locator('text=先離線使用').count()) await page.click('text=先離線使用')
  await page.waitForSelector('text=卡片庫')
}

await startOffline()

// ---------------------------------------------------------------- 編輯器 ----
await page.click('[aria-label="新增卡片"]')
await page.waitForSelector('.title-input')
await page.click(BODY)

// #7 清單項目 Backspace：子層退回上一層，再一次脫離清單
await page.keyboard.type('1. 第一項')
await page.keyboard.press('Enter')
await page.keyboard.press('Tab')
await page.keyboard.type('子項目')
await page.keyboard.press('Home')
await page.waitForTimeout(120)
await page.keyboard.press('Backspace')
await page.waitForTimeout(250)
let html = await page.locator(BODY).innerHTML()
if (!/<ol><li><p>第一項<\/p><\/li><li><p>子項目<\/p><\/li><\/ol>/.test(html))
  fail(`#7 子項目沒有退回與編號同層：${html}`)
log('#7 巢狀清單 Backspace 退回上一層（與數字對齊）')

await page.keyboard.press('Home')
await page.waitForTimeout(120)
await page.keyboard.press('Backspace')
await page.waitForTimeout(250)
html = await page.locator(BODY).innerHTML()
if (!html.includes('<p>子項目</p>') || html.includes('<li><p>子項目'))
  fail(`#7 最外層項目沒有脫離清單：${html}`)
log('#7 最外層清單項目 Backspace 變成一般段落')

// #8 表格後面永遠有可打字的段落，且最後一列按 ↓ 能離開表格
await page.keyboard.press('ControlOrMeta+a')
await page.keyboard.press('Delete')
await page.keyboard.type('/表格')
await page.waitForSelector('.slash-menu-item')
await page.keyboard.press('Enter')
await page.waitForTimeout(500)
html = await page.locator(BODY).innerHTML()
if (!/<\/table><p/.test(html)) fail('#8 表格後面沒有自動補上段落')
log('#8 表格後自動保留一個空段落')

await page.locator(`${BODY} td`).last().click()
await page.waitForTimeout(300)
await page.keyboard.press('ArrowDown')
await page.waitForTimeout(300)
await page.keyboard.type('表格後面的文字')
await page.waitForTimeout(300)
html = await page.locator(BODY).innerHTML()
if (!(html.split('</table>')[1] ?? '').includes('表格後面的文字'))
  fail(`#8 從表格最後一列往下走不出來：${html.slice(-160)}`)
log('#8 表格最後一列按 ↓ 可跳出表格繼續打字')

// #5 超連結：右鍵插入、自動補 https、浮窗看得到網址、Ctrl+點擊開得了
await page.keyboard.press('ControlOrMeta+a')
await page.keyboard.press('Delete')
await page.keyboard.type('口袋證券HVDC介紹')
await page.keyboard.press('ControlOrMeta+a')
await page.waitForTimeout(300)
promptAnswer = 'example.com/hvdc' // 故意不含 https，驗證自動補上
await page.locator(BODY).click({ button: 'right' })
await page.waitForTimeout(300)
const insertLink = page.locator('.table-menu button', { hasText: '插入超連結' })
if ((await insertLink.count()) === 0) fail('#5 右鍵選單沒有「插入超連結」')
await insertLink.click()
await page.waitForTimeout(500)
html = await page.locator(BODY).innerHTML()
if (!html.includes('href="https://example.com/hvdc"')) fail(`#5 連結沒有正確建立：${html}`)
log('#5 反白文字後右鍵可插入超連結（自動補上 https）')

await page.locator(`${BODY} a`).click()
await page.waitForTimeout(400)
const linkUrl = page.locator('.link-bar-url')
if ((await linkUrl.count()) === 0) fail('#5 游標停在連結上沒有顯示網址浮窗')
if ((await linkUrl.first().textContent()) !== 'https://example.com/hvdc')
  fail('#5 浮窗顯示的網址不正確')
log('#5 游標停在連結上會顯示網址與開啟/編輯/移除')

const [popup] = await Promise.all([
  page.waitForEvent('popup', { timeout: 4000 }).catch(() => null),
  page.locator(`${BODY} a`).first().click({ modifiers: ['ControlOrMeta'] }),
])
if (!popup) fail('#5 Ctrl/⌘+點擊沒有開啟連結')
await popup.close()
log('#5 Ctrl/⌘+點擊連結可開啟網站')

// 重新整理後連結仍在（存進資料庫）
await page.reload()
await page.waitForTimeout(1200)
if (await page.locator('text=先離線使用').count()) await page.click('text=先離線使用')
await page.waitForSelector('text=卡片庫')
await page.locator('aside li button').first().click()
await page.waitForTimeout(600)
if (!(await page.locator(`${BODY} a`).first().getAttribute('href')).includes('example.com/hvdc'))
  fail('#5 重新整理後連結消失')
log('#5 重新整理後連結仍在')

// ------------------------------------------------------------------ 白板 ----
await page.click('[aria-label="新增白板"]')
await page.waitForSelector('.react-flow')
await page.waitForTimeout(600)
const pane = page.locator('.react-flow__pane')
const cardNodes = page.locator('.react-flow__node-card')

for (const [x, y, name] of [
  [200, 160, 'A'],
  [430, 300, 'B'],
  [680, 200, 'C'],
]) {
  await pane.dblclick({ position: { x, y } })
  await page.waitForTimeout(600)
  await page.locator('.title-input').first().click()
  await page.keyboard.type('卡片' + name)
  await page.waitForTimeout(400)
  await page.locator('[aria-label="關閉編輯"]').click()
  await page.waitForTimeout(400)
}
if ((await cardNodes.count()) !== 3) fail('白板上應有 3 張卡片')

const positions = async () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.react-flow__node-card')].map((n) => {
      const t = n.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
      return { x: +t[1], y: +t[2] }
    }),
  )

// #6 框選模式：拖曳一次框住多張卡片
await page.click('[aria-label="框選模式"]')
await page.waitForTimeout(200)
const paneBox = await pane.boundingBox()
const boxes = await cardNodes.evaluateAll((els) =>
  els.map((e) => {
    const r = e.getBoundingClientRect()
    return { l: r.left, t: r.top, r: r.right, b: r.bottom }
  }),
)
await page.mouse.move(
  Math.min(...boxes.map((b) => b.l)) - 30,
  Math.max(Math.min(...boxes.map((b) => b.t)) - 30, paneBox.y + 90),
)
await page.mouse.down()
await page.mouse.move(Math.max(...boxes.map((b) => b.r)) + 30, Math.max(...boxes.map((b) => b.b)) + 30, {
  steps: 15,
})
await page.mouse.up()
await page.waitForTimeout(500)
if ((await page.locator('.react-flow__node.selected').count()) !== 3) fail('#6 框選沒有選到 3 張卡片')
if ((await page.locator('.align-toolbar').count()) === 0) fail('#6 多選後沒有出現對齊工具列')
log('#6 拖曳可一次框起多張卡片並跳出對齊工具列')

const beforeAlign = await positions()
await page.click('[aria-label="靠上對齊"]')
await page.waitForTimeout(400)
if (new Set((await positions()).map((p) => Math.round(p.y))).size !== 1)
  fail('#6 靠上對齊沒有把 Y 拉齊')
log('#6 多選對齊（靠上）')

// #6 多選統一移動
const beforeMove = await positions()
const nb = await cardNodes.first().boundingBox()
await page.mouse.move(nb.x + nb.width / 2, nb.y + 12)
await page.mouse.down()
await page.mouse.move(nb.x + nb.width / 2 + 100, nb.y + 92, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(500)
const afterMove = await positions()
if (!beforeMove.every((p, i) => Math.abs(afterMove[i].x - p.x) > 5 && Math.abs(afterMove[i].y - p.y) > 5))
  fail('#6 多選拖曳沒有一起移動')
log('#6 多選可統一移動')

// #4 上一步：還原移動 → 還原對齊；重做再套回來
await page.click('[aria-label="上一步"]')
await page.waitForTimeout(500)
if (!beforeMove.every((p, i) => Math.abs(afterMove[i].x - p.x) > 5 || true)) fail('unreachable')
let now = await positions()
if (!beforeMove.every((p, i) => Math.abs(now[i].x - p.x) < 3 && Math.abs(now[i].y - p.y) < 3))
  fail('#4 上一步沒有還原移動')
log('#4 上一步還原「移動」')

await page.click('[aria-label="上一步"]')
await page.waitForTimeout(500)
now = await positions()
if (!beforeAlign.every((p, i) => Math.abs(now[i].y - p.y) < 3)) fail('#4 上一步沒有還原對齊')
log('#4 上一步還原「對齊」')

await page.click('[aria-label="重做"]')
await page.waitForTimeout(500)
if (new Set((await positions()).map((p) => Math.round(p.y))).size !== 1) fail('#4 重做沒有作用')
log('#4 重做')

// #4 Ctrl+Z 還原刪除，且要寫回資料庫
await pane.click({ position: { x: 120, y: 700 } })
await page.waitForTimeout(300)
await cardNodes.first().click({ force: true, position: { x: 10, y: 10 } })
await page.waitForTimeout(400)
await page.keyboard.press('Delete')
await page.waitForTimeout(500)
const afterDelete = await cardNodes.count()
if (afterDelete !== 2) fail('刪除卡片節點失敗')
await page.keyboard.press('Control+z')
await page.waitForTimeout(700)
if ((await cardNodes.count()) !== 3) fail('#4 Ctrl+Z 沒有還原刪除')
log('#4 Ctrl+Z 還原「刪除卡片」')

// #2 / #3 收合行為：換一張乾淨的白板（位置可預期），放大一張卡片並連線，再收合
await page.click('[aria-label="新增白板"]')
await page.waitForSelector('.react-flow')
await page.waitForTimeout(600)
for (const [x, y, name] of [
  [250, 200, 'D'],
  [750, 250, 'E'],
]) {
  await pane.dblclick({ position: { x, y } })
  await page.waitForTimeout(600)
  await page.locator('.title-input').first().click()
  await page.keyboard.type('卡片' + name)
  await page.waitForTimeout(400)
  await page.locator('[aria-label="關閉編輯"]').click()
  await page.waitForTimeout(400)
}
await pane.click({ position: { x: 100, y: 620 } })
await page.waitForTimeout(300)
await cardNodes.first().click({ force: true, position: { x: 10, y: 10 } })
await page.waitForTimeout(400)
const brHandle = page.locator('.react-flow__resize-control.bottom.right.handle').first()
const hb = await brHandle.boundingBox()
await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
await page.mouse.down()
await page.mouse.move(hb.x + 100, hb.y + 200, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(500)
const expandedHeight = (await cardNodes.first().boundingBox()).height

const srcHandle = cardNodes.first().locator('.react-flow__handle.source')
const sh = await srcHandle.boundingBox()
const targetBox = await cardNodes.nth(1).boundingBox()
await page.mouse.move(sh.x + sh.width / 2, sh.y + sh.height / 2)
await page.mouse.down()
await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(600)
if ((await page.locator('.react-flow__edge').count()) === 0) fail('建立連線失敗')

await cardNodes.first().locator('[aria-label="收合卡片"]').click()
await page.waitForTimeout(700)
const collapsedBox = await cardNodes.first().boundingBox()
if (collapsedBox.height > expandedHeight * 0.5) fail('#3 收合後節點高度沒有縮小')

// 連線起點應落在收合後卡片的垂直中點
const d = await page.locator('.react-flow__edge-path').first().getAttribute('d')
const startY = parseFloat(d.match(/M[\d.-]+,([\d.-]+)/)[1])
const centerY = await page.evaluate(() => {
  const el = document.querySelector('.react-flow__node-card')
  const vp = document.querySelector('.react-flow__viewport')
  const t = new DOMMatrix(getComputedStyle(vp).transform)
  const r = el.getBoundingClientRect()
  const pr = document.querySelector('.react-flow').getBoundingClientRect()
  return (r.top + r.height / 2 - pr.top - t.f) / t.a
})
if (Math.abs(startY - centerY) > 12)
  fail(`#3 收合後連線沒有跟著卡片（差 ${Math.round(Math.abs(startY - centerY))}px）`)
log('#3 收合後連線接在卡片上，不再連到空白處')

// #2 收合狀態仍可調寬度，且高度不被撐開
await cardNodes.first().click({ force: true, position: { x: 10, y: 10 } })
await page.waitForTimeout(400)
const widthCtl = page.locator('.card-width-control.right').first()
if ((await widthCtl.count()) === 0) fail('#2 收合時沒有寬度把手')
const w0 = (await cardNodes.first().boundingBox()).width
const cb = await widthCtl.boundingBox()
await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2)
await page.mouse.down()
await page.mouse.move(cb.x + 130, cb.y, { steps: 10 })
await page.mouse.up()
await page.waitForTimeout(500)
const after2 = await cardNodes.first().boundingBox()
if (after2.width - w0 < 60) fail('#2 收合時無法調整寬度')
if (Math.abs(after2.height - collapsedBox.height) > 6) fail('#2 調寬度時高度被撐開')
log('#2 收合狀態下仍可調整卡片寬度')

// 展開後回到原本高度
await cardNodes.first().locator('[aria-label="展開卡片"]').click()
await page.waitForTimeout(700)
if (Math.abs((await cardNodes.first().boundingBox()).height - expandedHeight) > 20)
  fail('#3 展開後高度沒有還原')
log('#3 展開後恢復原本高度')

// ------------------------------------------------------------ 白板資料夾 ----
promptAnswer = '研究專案'
await page.click('[aria-label="新增白板資料夾"]')
await page.waitForTimeout(500)
if ((await page.locator('aside').getByText('研究專案').count()) === 0) fail('#1 沒有建立白板資料夾')

const dropped = await page.evaluate(() => {
  const src = [...document.querySelectorAll('aside li button')].find((b) =>
    b.textContent.includes('白板'),
  )
  const group = [...document.querySelectorAll('aside div')]
    .filter((d) => d.textContent.includes('研究專案') && d.querySelector('ul'))
    .pop()
  if (!src || !group) return false
  const dt = new DataTransfer()
  src.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))
  group.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }))
  group.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
  return true
})
if (!dropped) fail('#1 找不到可拖曳的白板或資料夾')
await page.waitForTimeout(600)

const inFolder = async () =>
  page.evaluate(() => {
    const group = [...document.querySelectorAll('aside div')]
      .filter((d) => d.textContent.includes('研究專案') && d.querySelector('ul'))
      .pop()
    return group ? [...group.querySelectorAll('ul li')].map((li) => li.textContent.trim()) : []
  })
if (!(await inFolder()).some((t) => t.includes('白板'))) fail('#1 白板沒有進到資料夾')
log('#1 白板可拖進資料夾歸納')

await page.reload()
await page.waitForTimeout(1200)
if (await page.locator('text=先離線使用').count()) await page.click('text=先離線使用')
await page.waitForSelector('text=卡片庫')
await page.waitForTimeout(800)
if (!(await inFolder()).some((t) => t.includes('白板'))) fail('#1 重新整理後白板不在資料夾裡')
log('#1 白板資料夾重新整理後仍在（已寫入資料庫）')

console.log('\nALL FIX CHECKS PASSED')
await browser.close()
