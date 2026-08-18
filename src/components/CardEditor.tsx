import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { BubbleMenu, EditorContent, useEditor } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import type { Content, Editor } from '@tiptap/core'
import type { Card } from '../types'
import { useCardStore } from '../store/useCardStore'
import { cardRepository } from '../db/cardRepository'
import { baseExtensions, fileToAttachment, fileToDataUrl } from '../editor/extensions'
import { SlashMenu } from '../editor/slashMenu'
import { CardLinkSuggestion } from '../editor/cardLink'
import { cardToMarkdown, downloadMarkdown } from '../editor/markdown'
import { normalizeUrl } from '../editor/linkUrl'
import { escapeHtml, getTitleHtml, setTitleHtml } from '../editor/titleFormat'
import { BacklinksPanel } from './BacklinksPanel'
import { TagChips } from './TagChips'

const SAVE_DEBOUNCE_MS = 400

// 回傳 [排程存檔, 立即補存]。卸載或分頁隱藏時可呼叫 flush 立即寫入未存的變更。
function useDebouncedSave(): [(fn: () => void) => void, () => void] {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<(() => void) | null>(null)

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (pending.current) {
      const fn = pending.current
      pending.current = null
      fn()
    }
  }, [])

  // 卸載（關閉抽屜、切換卡片/日期、離開日誌）時補存
  useEffect(() => flush, [flush])

  const schedule = useCallback((fn: () => void) => {
    pending.current = fn
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      pending.current = null
      fn()
    }, SAVE_DEBOUNCE_MS)
  }, [])

  return [schedule, flush]
}

// 文字顏色與螢光顏色調色盤（null = 清除）
const TEXT_COLORS: { key: string | null; color: string }[] = [
  { key: null, color: '#1f2937' },
  { key: '#dc2626', color: '#dc2626' },
  { key: '#ea580c', color: '#ea580c' },
  { key: '#16a34a', color: '#16a34a' },
  { key: '#2563eb', color: '#2563eb' },
  { key: '#7c3aed', color: '#7c3aed' },
]
const HL_COLORS: { key: string | null; color: string }[] = [
  { key: null, color: 'transparent' },
  { key: '#fef08a', color: '#fef08a' },
  { key: '#bbf7d0', color: '#bbf7d0' },
  { key: '#bfdbfe', color: '#bfdbfe' },
  { key: '#fbcfe8', color: '#fbcfe8' },
  { key: '#fed7aa', color: '#fed7aa' },
]

// 選字後跳出的格式工具列（features.md 模組 2：粗體/斜體/底線/刪除線/文字色/螢光/標題大小）
function FormatBar({ editor }: { editor: Editor }) {
  const [, force] = useReducer((x: number) => x + 1, 0)
  // 只在選取變動時更新（避免每次 transaction 都重繪造成浮層抖動）
  useEffect(() => {
    const rerender = () => force()
    editor.on('selectionUpdate', rerender)
    return () => {
      editor.off('selectionUpdate', rerender)
    }
  }, [editor])

  const btn = (active: boolean) =>
    `format-btn${active ? ' is-active' : ''}`

  return (
    // 按下工具列不要奪走編輯器選取（否則指令會作用在空選取上）
    <div className="format-bar" onMouseDown={(e) => e.preventDefault()}>
    <div className="format-row">
      <button
        type="button"
        className={btn(editor.isActive('paragraph') && !editor.isActive('heading'))}
        onClick={() => editor.chain().focus().setParagraph().run()}
        title="內文"
      >
        內文
      </button>
      {([1, 2, 3] as const).map((level) => (
        <button
          key={level}
          type="button"
          className={btn(editor.isActive('heading', { level }))}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          title={`標題 ${level}`}
        >
          H{level}
        </button>
      ))}
      <span className="format-sep" />
      <button
        type="button"
        className={btn(editor.isActive('bold'))}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="粗體"
      >
        <b>B</b>
      </button>
      <button
        type="button"
        className={btn(editor.isActive('italic'))}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="斜體"
      >
        <i>I</i>
      </button>
      <button
        type="button"
        className={btn(editor.isActive('underline'))}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="底線"
      >
        <u>U</u>
      </button>
      <button
        type="button"
        className={btn(editor.isActive('strike'))}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="刪除線"
      >
        <s>S</s>
      </button>
      <button
        type="button"
        className={btn(editor.isActive('highlight'))}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        title="螢光標記"
      >
        <span className="format-hl">H</span>
      </button>
      <button
        type="button"
        className={btn(editor.isActive('code'))}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="行內程式碼"
      >
        {'</>'}
      </button>
      <span className="format-sep" />
      <button
        type="button"
        className="format-btn"
        title="加入網址連結"
        onClick={() => promptForLink(editor)}
      >
        🔗
      </button>
      <button
        type="button"
        className="format-btn format-btn-wide"
        title="把選取文字抽成一張新卡片並連結"
        onClick={() => {
          const { from, to } = editor.state.selection
          const text = editor.state.doc.textBetween(from, to, ' ').trim()
          if (!text) return
          void (async () => {
            // 直接用 repository 建卡（不改變目前選取，避免主編輯器畫面跳走）
            const card = await cardRepository.create()
            await cardRepository.update(card.id, {
              title: text,
              content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
            })
            await useCardStore.getState().load()
            editor
              .chain()
              .focus()
              .deleteRange({ from, to })
              .insertContent([
                { type: 'cardLink', attrs: { cardId: card.id, label: text } },
                { type: 'text', text: ' ' },
              ])
              .run()
          })()
        }}
      >
        抽成卡片
      </button>
    </div>
    <div className="format-row">
      <span className="format-label">字色</span>
      {TEXT_COLORS.map((c) => (
        <button
          key={c.key ?? 'default'}
          type="button"
          aria-label={`文字顏色 ${c.key ?? '預設'}`}
          title={c.key ?? '預設'}
          className="format-swatch"
          style={{ color: c.color }}
          onClick={() =>
            c.key
              ? editor.chain().focus().setColor(c.key).run()
              : editor.chain().focus().unsetColor().run()
          }
        >
          A
        </button>
      ))}
      <span className="format-sep" />
      <span className="format-label">螢光</span>
      {HL_COLORS.map((c) => (
        <button
          key={c.key ?? 'none'}
          type="button"
          aria-label={`螢光顏色 ${c.key ?? '清除'}`}
          title={c.key ?? '清除'}
          className={`format-swatch format-swatch-hl${c.key ? '' : ' is-none'}`}
          style={{ background: c.color }}
          onClick={() =>
            c.key
              ? editor.chain().focus().toggleHighlight({ color: c.key }).run()
              : editor.chain().focus().unsetHighlight().run()
          }
        />
      ))}
    </div>
    </div>
  )
}

// 標題編輯器：僅段落 + 基本標記（無標題/清單/表格），單行。
const titleExtensions = [
  StarterKit.configure({
    heading: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
    blockquote: false,
    codeBlock: false,
    horizontalRule: false,
  }),
  Underline,
  Highlight.configure({ multicolor: true }),
  TextStyle,
  Color,
  Placeholder.configure({ placeholder: '未命名卡片' }),
]

const TITLE_TEXT_COLORS = ['#dc2626', '#ea580c', '#16a34a', '#2563eb', '#7c3aed']

// 標題選字後的格式工具列（#9：粗體/斜體/底線/刪除線/螢光/文字色）
function TitleFormatBar({ editor }: { editor: Editor }) {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    const rerender = () => force()
    editor.on('selectionUpdate', rerender)
    editor.on('transaction', rerender)
    return () => {
      editor.off('selectionUpdate', rerender)
      editor.off('transaction', rerender)
    }
  }, [editor])
  const btn = (active: boolean) => `format-btn${active ? ' is-active' : ''}`
  return (
    <div className="format-bar" onMouseDown={(e) => e.preventDefault()}>
      <div className="format-row">
        <button type="button" className={btn(editor.isActive('bold'))} title="粗體" onClick={() => editor.chain().focus().toggleBold().run()}>
          <b>B</b>
        </button>
        <button type="button" className={btn(editor.isActive('italic'))} title="斜體" onClick={() => editor.chain().focus().toggleItalic().run()}>
          <i>I</i>
        </button>
        <button type="button" className={btn(editor.isActive('underline'))} title="底線" onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <u>U</u>
        </button>
        <button type="button" className={btn(editor.isActive('strike'))} title="刪除線" onClick={() => editor.chain().focus().toggleStrike().run()}>
          <s>S</s>
        </button>
        <button type="button" className={btn(editor.isActive('highlight'))} title="螢光" onClick={() => editor.chain().focus().toggleHighlight().run()}>
          <span className="format-hl">H</span>
        </button>
        <span className="format-sep" />
        {TITLE_TEXT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`標題文字顏色 ${c}`}
            title="文字顏色"
            className="format-swatch"
            style={{ color: c }}
            onClick={() => editor.chain().focus().setColor(c).run()}
          >
            A
          </button>
        ))}
        <button type="button" className="format-btn" title="清除顏色" onClick={() => editor.chain().focus().unsetColor().run()}>
          ⊘
        </button>
      </div>
    </div>
  )
}

// ---- 超連結（#5）----

/** 詢問網址並套用到目前選取（空字串＝移除連結） */
function promptForLink(editor: Editor): void {
  const prev = editor.getAttributes('link').href as string | undefined
  const input = window.prompt('連結網址（留空移除連結）', prev ?? 'https://')
  if (input === null) return
  const href = normalizeUrl(input)
  if (!href) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  // 游標只是停在連結上（沒有反白）時，整段連結一起換掉
  editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
}

function openLink(href: string): void {
  window.open(href, '_blank', 'noopener,noreferrer')
}

// 游標停在連結上時出現的浮窗：看得到網址，並可開啟/編輯/移除（#5）
function LinkBar({ editor }: { editor: Editor }) {
  const href = (editor.getAttributes('link').href as string | undefined) ?? ''
  return (
    <div className="format-bar" onMouseDown={(e) => e.preventDefault()}>
      <div className="format-row">
        <a
          className="link-bar-url"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={href}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {href}
        </a>
        <span className="format-sep" />
        <button type="button" className="format-btn" title="開啟連結" onClick={() => openLink(href)}>
          開啟
        </button>
        <button type="button" className="format-btn" title="編輯連結" onClick={() => promptForLink(editor)}>
          編輯
        </button>
        <button
          type="button"
          className="format-btn"
          title="移除連結"
          onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
        >
          移除
        </button>
      </div>
    </div>
  )
}

// 游標在表格內時出現的快捷列（#5）：直接點「＋欄 / ＋列」新增
function TableBar({ editor }: { editor: Editor }) {
  return (
    <div className="format-bar" onMouseDown={(e) => e.preventDefault()}>
      <div className="format-row">
        <button type="button" className="format-btn format-btn-wide" onClick={() => editor.chain().focus().addColumnAfter().run()}>
          ＋欄
        </button>
        <button type="button" className="format-btn format-btn-wide" onClick={() => editor.chain().focus().addRowAfter().run()}>
          ＋列
        </button>
        <span className="format-sep" />
        <button type="button" className="format-btn" title="刪除所選欄" onClick={() => editor.chain().focus().deleteColumn().run()}>
          刪欄
        </button>
        <button type="button" className="format-btn" title="刪除所選列" onClick={() => editor.chain().focus().deleteRow().run()}>
          刪列
        </button>
        <button type="button" className="format-btn" title="刪除整個表格" onClick={() => editor.chain().focus().deleteTable().run()}>
          刪表
        </button>
      </div>
    </div>
  )
}

export function CardEditor({
  card,
  compact = false,
  hideTitle = false,
}: {
  card: Card
  compact?: boolean
  hideTitle?: boolean
}) {
  const updateCard = useCardStore((s) => s.updateCard)
  const [scheduleTitleSave, flushTitle] = useDebouncedSave()
  const [scheduleContentSave, flushContent] = useDebouncedSave()

  // 分頁關閉或切到背景時（手機切 App、關分頁）也把未存變更立即寫入
  useEffect(() => {
    const flushAll = () => {
      flushTitle()
      flushContent()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushAll()
    }
    window.addEventListener('pagehide', flushAll)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flushAll)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [flushTitle, flushContent])

  // 標題改為輕量編輯器（#9 可選字加粗/變色/螢光）。純文字存 card.title、格式存本機。
  // 本元件在各處都以 key={card.id} 掛載，切換卡片會重新掛載並重新初始化。
  const titleEditor = useEditor(
    {
      extensions: titleExtensions,
      // 優先用已同步的 card.titleHtml；其次相容舊的本機格式；再退回純文字
      content:
        card.titleHtml ||
        getTitleHtml(card.id) ||
        (card.title ? `<p>${escapeHtml(card.title)}</p>` : ''),
      editorProps: {
        attributes: { class: `title-input ${compact ? 'is-compact' : ''}` },
        // 標題為單行：Enter 不換行
        handleKeyDown: (_, event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            return true
          }
          return false
        },
      },
      onUpdate: ({ editor }) => {
        const plain = editor.getText()
        const html = editor.getHTML()
        scheduleTitleSave(() => {
          // 有實際格式才存 HTML，否則存 null（節點/其他處退回純文字），並保持 DB 乾淨
          const plainWrapped = `<p>${escapeHtml(plain)}</p>`
          const titleHtml = !plain.trim() || html === plainWrapped || html === '<p></p>' ? null : html
          void updateCard(card.id, { title: plain, titleHtml })
          // 舊的本機格式已搬到雲端欄位，清掉本機殘留
          setTitleHtml(card.id, plainWrapped, plain)
        })
      },
    },
    [card.id],
  )

  const extensions = useMemo(
    () => [
      ...baseExtensions,
      Placeholder.configure({ placeholder: '輸入內容，「/」區塊選單、「[[」連結卡片…' }),
      SlashMenu,
      CardLinkSuggestion,
    ],
    [],
  )

  const editor = useEditor(
    {
      extensions,
      content: card.content as Content,
      onUpdate: ({ editor }) => {
        const json = editor.getJSON()
        scheduleContentSave(() => void updateCard(card.id, { content: json }))
      },
      // 貼上/拖曳圖片 → 轉 data URL 插入圖片區塊（features.md 模組 2 P1）
      editorProps: {
        // #5 Ctrl/⌘＋點擊連結直接開新分頁（單純點擊仍是移動游標，才編得了字）
        handleClick: (_view, _pos, event) => {
          if (!(event.metaKey || event.ctrlKey)) return false
          const href = (event.target as HTMLElement)?.closest('a')?.getAttribute('href')
          if (!href) return false
          event.preventDefault()
          openLink(href)
          return true
        },
        handlePaste: (view, event) => {
          const file = Array.from(event.clipboardData?.files ?? []).find((f) =>
            f.type.startsWith('image/'),
          )
          if (!file) return false
          void fileToDataUrl(file).then((src) => {
            const { schema, tr } = view.state
            view.dispatch(tr.replaceSelectionWith(schema.nodes.image.create({ src })))
          })
          return true
        },
        handleDrop: (view, event) => {
          const file = Array.from(event.dataTransfer?.files ?? [])[0]
          if (!file) return false
          const posAt = () =>
            view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ??
            view.state.selection.to
          if (file.type.startsWith('image/')) {
            void fileToDataUrl(file).then((src) => {
              view.dispatch(view.state.tr.insert(posAt(), view.state.schema.nodes.image.create({ src })))
            })
          } else {
            void fileToAttachment(file).then((attrs) => {
              if (!attrs) {
                window.alert('檔案超過 5MB 上限，暫不支援（避免拖慢同步）。')
                return
              }
              view.dispatch(
                view.state.tr.insert(posAt(), view.state.schema.nodes.fileAttachment.create(attrs)),
              )
            })
          }
          return true
        },
      },
    },
    [card.id],
  )

  // 右鍵選單（#5 超連結／表格操作）：座標為 null 代表未開啟
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; inTable: boolean; hasSelection: boolean; linkHref: string | null } | null>(null)

  const closeCtxMenu = () => setCtxMenu(null)
  const runCtx = (fn: () => void) => {
    fn()
    closeCtxMenu()
  }

  // 右鍵：有反白文字、游標在連結上、或在表格內時，改用自訂選單
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!editor) return
      const { state } = editor
      const hasSelection = !state.selection.empty
      const linkHref = (editor.getAttributes('link').href as string | undefined) ?? null
      const inTable = editor.isActive('table')
      if (!hasSelection && !linkHref && !inTable) return // 其餘情況保留瀏覽器原生選單
      e.preventDefault()
      setCtxMenu({ x: e.clientX, y: e.clientY, inTable, hasSelection, linkHref })
    },
    [editor],
  )

  return (
    <div className={hideTitle ? '' : 'flex h-full flex-col overflow-y-auto'}>
      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 0, maxWidth: 'none' }}>
          <FormatBar editor={editor} />
        </BubbleMenu>
      )}
      {/* 游標停在連結上：顯示網址與開啟/編輯/移除（#5） */}
      {editor && (
        <BubbleMenu
          editor={editor}
          pluginKey="linkBar"
          shouldShow={({ editor, state }) => editor.isActive('link') && state.selection.empty}
          tippyOptions={{ duration: 0, placement: 'bottom', maxWidth: 'none' }}
        >
          <LinkBar editor={editor} />
        </BubbleMenu>
      )}
      {/* 游標在表格內、且未選字時，顯示表格快捷列（#5） */}
      {editor && (
        <BubbleMenu
          editor={editor}
          pluginKey="tableBar"
          shouldShow={({ editor, state }) => editor.isActive('table') && state.selection.empty && !editor.isActive('link')}
          tippyOptions={{ duration: 0, placement: 'top' }}
        >
          <TableBar editor={editor} />
        </BubbleMenu>
      )}
      {/* 右鍵選單：超連結（#5）＋表格操作 */}
      {ctxMenu && editor && (
        <>
          <div className="table-menu-backdrop" onClick={closeCtxMenu} onContextMenu={(e) => { e.preventDefault(); closeCtxMenu() }} />
          <div className="table-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
            {ctxMenu.linkHref && (
              <>
                <button type="button" onClick={() => runCtx(() => openLink(ctxMenu.linkHref!))}>🔗 開啟連結</button>
                <button type="button" onClick={() => runCtx(() => promptForLink(editor))}>編輯連結網址</button>
                <button type="button" onClick={() => runCtx(() => void navigator.clipboard?.writeText(ctxMenu.linkHref!))}>複製連結網址</button>
                <button type="button" onClick={() => runCtx(() => editor.chain().focus().extendMarkRange('link').unsetLink().run())}>移除連結</button>
              </>
            )}
            {!ctxMenu.linkHref && ctxMenu.hasSelection && (
              <button type="button" onClick={() => runCtx(() => promptForLink(editor))}>🔗 插入超連結</button>
            )}
            {ctxMenu.inTable && (
              <>
                {(ctxMenu.linkHref || ctxMenu.hasSelection) && <div className="table-menu-sep" />}
                <button type="button" onClick={() => runCtx(() => editor.chain().focus().addColumnBefore().run())}>在左邊插入欄</button>
                <button type="button" onClick={() => runCtx(() => editor.chain().focus().addColumnAfter().run())}>在右邊插入欄</button>
                <button type="button" onClick={() => runCtx(() => editor.chain().focus().addRowBefore().run())}>在上面插入列</button>
                <button type="button" onClick={() => runCtx(() => editor.chain().focus().addRowAfter().run())}>在下面插入列</button>
                <div className="table-menu-sep" />
                <button type="button" className="is-danger" onClick={() => runCtx(() => editor.chain().focus().deleteColumn().run())}>刪除所選欄</button>
                <button type="button" className="is-danger" onClick={() => runCtx(() => editor.chain().focus().deleteRow().run())}>刪除所選列</button>
                <button type="button" className="is-danger" onClick={() => runCtx(() => editor.chain().focus().deleteTable().run())}>刪除整個表格</button>
              </>
            )}
          </div>
        </>
      )}
      <div
        className={
          hideTitle ? 'w-full' : compact ? 'w-full px-5 py-5' : 'mx-auto w-full max-w-3xl px-8 py-10'
        }
      >
        {!hideTitle && (
          <>
            <div className="flex items-start gap-2">
              {titleEditor && (
                <BubbleMenu editor={titleEditor} tippyOptions={{ duration: 0, maxWidth: 'none' }}>
                  <TitleFormatBar editor={titleEditor} />
                </BubbleMenu>
              )}
              <div className="min-w-0 flex-1">
                <EditorContent editor={titleEditor} />
              </div>
              <button
                type="button"
                title="匯出 Markdown"
                onClick={() =>
                  downloadMarkdown(`${card.title || '未命名卡片'}.md`, cardToMarkdown(card))
                }
                className="mt-1 shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
              >
                ↓ MD
              </button>
            </div>
            <TagChips cardId={card.id} />
          </>
        )}
        <div
          className={hideTitle ? 'journal-editor' : 'mt-4'}
          onContextMenu={handleContextMenu}
        >
          <EditorContent editor={editor} />
        </div>
        <BacklinksPanel cardId={card.id} />
      </div>
    </div>
  )
}
