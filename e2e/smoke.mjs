// 核心 happy path 冒煙測試（需先啟動 dev server：npm run dev）
// 涵蓋 M1（建卡→編輯→持久化→刪除）與 M2（白板、上板、一卡兩板同步）
import { chromium } from 'playwright'

const CHROMIUM =
  process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'

const browser = await chromium.launch({ executablePath: CHROMIUM })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const log = (m) => console.log('✓', m)
// confirm 一律 OK；prompt 回傳 nextPrompt（預設空字串，等同原本行為）
let nextPrompt = ''
page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? nextPrompt : undefined))

await page.goto(BASE_URL)
// M0：已設定 Supabase → 首次載入出現登入頁；測試走離線路徑
await page.waitForSelector('text=先離線使用')
await page.click('text=先離線使用')
await page.waitForSelector('text=卡片庫')
await page.waitForSelector('text=尚未同步（離線模式）')
log('app loaded (login gate -> offline mode)')

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

// 表格區塊（M5：/表格 插入 3x3 含表頭）
await page.keyboard.press('Enter')
await page.keyboard.press('Enter')
await page.keyboard.type('/表格')
await page.waitForSelector('.slash-menu-item')
await page.keyboard.press('Enter')
await page.waitForSelector('.tiptap table th')
await page.keyboard.type('表頭一')
if (!(await page.textContent('.tiptap table th'))?.includes('表頭一'))
  throw new Error('table block failed')
log('M5: table block inserted and editable')

// 選字格式工具列（粗體）
await page.click('.tiptap p:has-text("這是內文。")', { clickCount: 3 })
await page.waitForSelector('.format-bar')
await page.click('.format-bar button[title="粗體"]')
if (!(await page.$('.tiptap strong'))) throw new Error('bold via format bar failed')
log('新: format bar bold works')

// 文字顏色（藍）：選較低的清單項目，避免浮層與標題/標籤列重疊
await page.click('.tiptap ul li', { clickCount: 3 })
await page.waitForSelector('.format-bar')
await page.waitForTimeout(150)
await page.click('.format-bar button[aria-label="文字顏色 #2563eb"]')
await page.waitForTimeout(150)
const coloredSpan = await page.$('.tiptap span[style*="color"]')
if (!coloredSpan) throw new Error('text color not applied')
log('新: text color applies')

// #6 抽成卡片：新增一段，選取後抽成一張新卡片並連結
await page.click('.tiptap')
await page.keyboard.press('Control+End')
await page.keyboard.press('Enter')
await page.keyboard.type('關鍵概念X')
await page.click('.tiptap p:has-text("關鍵概念X")', { clickCount: 3 })
await page.waitForSelector('.format-bar')
await page.click('.format-bar button[title="把選取文字抽成一張新卡片並連結"]')
await page.waitForSelector('.tiptap .card-link:has-text("關鍵概念X")')
await page.waitForSelector('aside:has-text("關鍵概念X")')
log('新: turn selection into a linked card (#6)')

// #7 檔案附件：用 /檔案 指令挑一個小檔案插入
{
  const [fc] = await Promise.all([
    page.waitForEvent('filechooser'),
    (async () => {
      await page.click('.tiptap')
      await page.keyboard.press('Control+End')
      await page.keyboard.press('Enter')
      await page.keyboard.type('/檔案')
      await page.waitForSelector('.slash-menu-item')
      await page.keyboard.press('Enter')
    })(),
  ])
  await fc.setFiles({ name: '筆記.txt', mimeType: 'text/plain', buffer: Buffer.from('hello attachment') })
  await page.waitForSelector('.tiptap a.file-attach:has-text("筆記.txt")')
}
log('新: file attachment inserted (#7)')

// 標題可逐字輸入且不遺失（IME 修復的回歸保護）＋側邊欄同步
await page.fill('input[placeholder="未命名卡片"]', '')
await page.click('input[placeholder="未命名卡片"]')
await page.keyboard.type('重新命名的標題')
if ((await page.inputValue('input[placeholder="未命名卡片"]')) !== '重新命名的標題')
  throw new Error('title typing lost characters')
await page.waitForSelector('aside >> text=重新命名的標題')
log('新: title types fully and syncs to sidebar (IME fix)')
// 還原名稱，後續步驟仍以原名尋找
await page.fill('input[placeholder="未命名卡片"]', '我的第一張卡片')
await page.waitForSelector('aside >> text=我的第一張卡片')

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
await page.waitForSelector('.react-flow__minimap')
log('M2: whiteboard created and opened (with minimap)')

// 雙擊空白處新增卡片（會開啟右側編輯抽屜）
await page.dblclick('.react-flow__pane', { position: { x: 500, y: 300 } })
await page.waitForSelector('text=編輯卡片')
await page.fill('input[placeholder="未命名卡片"]', '白板上的卡片')
await page.waitForSelector('.card-node-title:has-text("白板上的卡片")')
log('M2: dblclick creates card, drawer edit syncs to node')

// 關閉時強制存檔：打字後「不等 debounce」立刻關閉，內容仍存入節點
await page.click('.flex.w-96 .tiptap')
await page.keyboard.type('關閉前最後一句')
await page.click('[aria-label="關閉編輯"]') // 立即關閉（< 400ms debounce）
await page.waitForSelector('.card-node-body:has-text("關閉前最後一句")')
log('新: edit flushes on close (no data loss)')

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

// ---- M5：白板深化（便利貼、區域、卡片顏色）----
await page.click('button:has-text("＋ 便利貼")')
await page.waitForSelector('.sticky-node')
// 先把便利貼拖離中心，避免蓋住卡片節點
{
  const box = await page.locator('.sticky-node').boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x - 260, box.y + 200, { steps: 8 })
  await page.mouse.up()
}
await page.click('.sticky-node') // 選取後才進入編輯
await page.fill('textarea.sticky-node-input', '記得補充參考資料')
await page.locator('textarea.sticky-node-input').blur()
await page.waitForTimeout(300)
log('M5: sticky note added, dragged and edited')

// #2 便利貼左側總表：側邊欄出現便利貼區與內容
await page.waitForSelector('aside >> text=便利貼')
await page.waitForSelector('aside >> text=記得補充參考資料')
log('新: sticky note listed in sidebar (#2)')

await page.click('button:has-text("＋ 區域")')
await page.waitForSelector('.section-node')
log('M5: section added')

// #1 區域存在時卡片仍可點選，且有「從白板移除」鈕（區域主體不再攔截點擊）
await page.click('.card-node')
await page.waitForSelector('.react-flow__node-card.selected')
await page.waitForSelector('[aria-label="從白板移除此卡片"]')
log('新: card selectable with a section present + board-remove button (#1)')

await page.click('.card-node')
await page.waitForSelector('.card-color-toolbar')
await page.click('[aria-label="卡片顏色 黃"]')
await page.waitForTimeout(300)
const cardBg = await page.$eval('.card-node', (el) => getComputedStyle(el).backgroundColor)
if (!cardBg.includes('255, 251, 235')) throw new Error('card color failed: ' + cardBg)
log('M5: card color applied from toolbar')

await page.reload()
await page.click('aside >> text=白板 1')
await page.waitForSelector('.sticky-node:has-text("記得補充參考資料")')
await page.waitForSelector('.section-node')
const persistedBg = await page.$eval('.card-node', (el) => getComputedStyle(el).backgroundColor)
if (!persistedBg.includes('255, 251, 235')) throw new Error('color persistence failed')
log('M5: sticky/section/color persist after reload')

// 便利貼刪除按鈕（選取後工具列出現 🗑 刪除）
await page.click('.sticky-node')
await page.click('button[aria-label="刪除便利貼"]')
await page.waitForSelector('.sticky-node', { state: 'detached' })
log('新: sticky delete button removes the note')

// ---- M3：日誌 + 雙向連結 ----
await page.click('aside >> text=日誌')
await page.waitForSelector('text=今天')
log('M3: journal opens with today entry')

// #5 Journey：頂部日期導覽（本週＋下週），點日期建立/開啟該天
await page.waitForSelector('text=本週與下週')
{
  const firstDay = page.locator('.grid.grid-cols-7 button[aria-label]').first()
  const picked = await firstDay.getAttribute('aria-label')
  await firstDay.click()
  // 點選後該日期格變成選中樣式（深底白字）
  await page.waitForSelector(`.grid.grid-cols-7 button[aria-label="${picked}"].bg-gray-900`)
  // 該天的日誌區段標題出現（YYYY年M月D日）
  const [, m, d] = picked.split('-')
  await page.waitForSelector(`text=${Number(m)}月${Number(d)}日`)
}
log('新: journey calendar picks a date and creates its entry (#5)')

// 展開月曆、收合兩週
await page.click('text=展開月曆 ▾')
await page.waitForSelector('text=收合兩週 ▴')
await page.click('text=收合兩週 ▴')
await page.waitForSelector('text=本週與下週')
log('新: journey calendar toggles month/weeks (#5)')

// 回到今天，讓後續連結測試作用在今天的日誌
await page.click('text=今天')
await page.waitForSelector('text=今天')

await page.click('.journal-editor .tiptap')
await page.keyboard.type('參考 [[我的第一')
await page.waitForSelector('.slash-menu-item')
await page.keyboard.press('Enter')
await page.waitForSelector('.journal-editor .card-link:has-text("我的第一張卡片")')
log('M3: [[ suggestion inserts card link in journal')

// hover 連結 chip 顯示卡片內容預覽
await page.hover('.journal-editor .card-link')
await page.waitForSelector('.link-preview')
await page.mouse.move(10, 10)
log('M5: link hover preview appears')

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

// ---- M5：未連結提及 ----
await page.click('[aria-label="新增卡片"]')
await page.waitForFunction(
  () => document.querySelector('input[placeholder="未命名卡片"]')?.value === '',
)
await page.fill('input[placeholder="未命名卡片"]', '隨手記')
await page.click('.tiptap')
await page.keyboard.type('這段提到了我的第一張卡片但沒有加連結。')
await page.waitForTimeout(800)

await page.click('aside >> text=我的第一張卡片')
await page.waitForSelector('text=未連結提及')
await page.click('button:has-text("轉為連結")')
await page.waitForSelector('text=未連結提及', { state: 'detached' })
await page.waitForSelector('main >> text=隨手記')
log('M5: unlinked mention detected and converted to a backlink')

// ---- M4：標籤、搜尋、垃圾桶 ----
await page.click('aside >> text=我的第一張卡片')
await page.waitForSelector('button:has-text("＋ 標籤")')
await page.click('button:has-text("＋ 標籤")')
await page.keyboard.type('靈感')
await page.keyboard.press('Enter')
await page.waitForSelector('aside li:has-text("靈感")')
log('M4: tag added to card, appears in sidebar')

await page.click('aside li:has-text("靈感") button')
await page.waitForSelector('h1:has-text("# 靈感")')
await page.waitForSelector('text=我的第一張卡片')
log('M4: tag page lists tagged cards')

// 標籤顏色（#2）：挑藍色，標題文字轉為藍色
await page.click('button[aria-label="標籤顏色 藍"]')
await page.waitForTimeout(200)
const h1Color = await page.$eval('h1:has-text("# 靈感")', (el) => getComputedStyle(el).color)
if (!h1Color.includes('29, 78, 216')) throw new Error('tag color not applied: ' + h1Color)
log('新: tag color applies (#2)')

// ---- M5：標籤資料庫（屬性、表格、看板）----
await page.click('button:has-text("＋ 屬性")')
await page.fill('input[placeholder="屬性名稱"]', '狀態')
await page.selectOption('select[aria-label="屬性型別"]', 'select')
await page.fill('input[placeholder="選項（逗號分隔）"]', '待讀,閱讀中,完成')
await page.click('button:has-text("新增"):right-of(input[placeholder="屬性名稱"])')
await page.waitForSelector('th >> text=狀態')
log('M5: custom select property added')

await page.selectOption('td select[aria-label="狀態"]', '閱讀中')
await page.waitForTimeout(400)
await page.click('button:has-text("看板")')
await page.waitForSelector('[data-kanban-column="閱讀中"] >> text=我的第一張卡片')
log('M5: kanban groups card under its select value')

await page.click('button:has-text("表格")')
await page.waitForSelector('th >> text=狀態')

// Cmd+K 全文搜尋跳轉
await page.keyboard.press('Control+k')
await page.waitForSelector('input[placeholder="搜尋卡片、白板，或執行指令…"]')
await page.keyboard.type('章節一')
await page.waitForSelector('li >> text=我的第一張卡片')
await page.keyboard.press('Enter')
await page.waitForSelector('input[placeholder="未命名卡片"]')
const openedTitle = await page.inputValue('input[placeholder="未命名卡片"]')
if (openedTitle !== '我的第一張卡片') throw new Error('palette jump failed: ' + openedTitle)
log('M4: Cmd+K full-text search jumps to card')

// 垃圾桶：刪除 → 還原 → 永久刪除
await page.click('[aria-label="新增卡片"]')
// 等新卡片（空標題）真的選上，避免把標題填進上一張卡
await page.waitForFunction(
  () => document.querySelector('input[placeholder="未命名卡片"]')?.value === '',
)
await page.fill('input[placeholder="未命名卡片"]', '要刪的卡片')
await page.waitForTimeout(500)
await page.hover('aside li:has-text("要刪的卡片")')
await page.click('aside li:has-text("要刪的卡片") [aria-label="刪除卡片"]')
await page.click('text=🗑 垃圾桶')
await page.waitForSelector('main >> text=要刪的卡片')
await page.click('button:has-text("還原")')
await page.waitForSelector('aside >> text=要刪的卡片')
log('M4: trash restore works')

await page.hover('aside li:has-text("要刪的卡片")')
await page.click('aside li:has-text("要刪的卡片") [aria-label="刪除卡片"]')
await page.click('text=🗑 垃圾桶')
await page.waitForSelector('main >> text=要刪的卡片')
await page.click('button:has-text("永久刪除")')
await page.waitForSelector('text=垃圾桶是空的')
log('M4: permanent delete works')

// ---- #8：卡片資料夾 ----
await page.click('aside >> text=卡片庫')
nextPrompt = '我的資料夾'
await page.click('[aria-label="新增資料夾"]')
await page.waitForSelector('aside >> text=我的資料夾')
log('新: folder created (#8)')

// 拖一張既有卡片到資料夾
{
  const dt = await page.evaluateHandle(() => new DataTransfer())
  await page.dispatchEvent('aside button:has-text("我的第一張卡片")', 'dragstart', {
    dataTransfer: dt,
  })
  await page.dispatchEvent('aside button:has-text("我的資料夾")', 'drop', { dataTransfer: dt })
}
await page.waitForFunction(() => {
  const btns = [...document.querySelectorAll('aside button')]
  const f = btns.find((b) => b.textContent?.includes('我的資料夾'))
  return f && /我的資料夾\s*1/.test(f.textContent || '')
})
log('新: drag card into folder assigns it (#8)')

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
