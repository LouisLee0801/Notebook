import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { BubbleMenu, EditorContent, useEditor } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import type { Content, Editor } from '@tiptap/core'
import type { Card } from '../types'
import { useCardStore } from '../store/useCardStore'
import { baseExtensions, fileToDataUrl } from '../editor/extensions'
import { SlashMenu } from '../editor/slashMenu'
import { CardLinkSuggestion } from '../editor/cardLink'
import { cardToMarkdown, downloadMarkdown } from '../editor/markdown'
import { BacklinksPanel } from './BacklinksPanel'
import { TagChips } from './TagChips'

const SAVE_DEBOUNCE_MS = 400

function useDebouncedSave() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  return (fn: () => void) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(fn, SAVE_DEBOUNCE_MS)
  }
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
  const scheduleTitleSave = useDebouncedSave()
  const scheduleContentSave = useDebouncedSave()

  // 標題用本地狀態，避免每次輸入都被 store 回寫覆蓋 —— 那會中斷注音/拼音的組字。
  // 本元件在各處都以 key={card.id} 掛載，切換卡片會重新掛載並重新初始化，故不需額外同步。
  const [title, setTitle] = useState(card.title)

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
          const file = Array.from(event.dataTransfer?.files ?? []).find((f) =>
            f.type.startsWith('image/'),
          )
          if (!file) return false
          void fileToDataUrl(file).then((src) => {
            const pos =
              view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ??
              view.state.selection.to
            view.dispatch(view.state.tr.insert(pos, view.state.schema.nodes.image.create({ src })))
          })
          return true
        },
      },
    },
    [card.id],
  )

  return (
    <div className={hideTitle ? '' : 'flex h-full flex-col overflow-y-auto'}>
      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 0 }}>
          <FormatBar editor={editor} />
        </BubbleMenu>
      )}
      <div
        className={
          hideTitle ? 'w-full' : compact ? 'w-full px-5 py-5' : 'mx-auto w-full max-w-3xl px-8 py-10'
        }
      >
        {!hideTitle && (
          <>
            <div className="flex items-start gap-2">
              <input
                className={`w-full min-w-0 flex-1 bg-transparent font-bold outline-none placeholder:text-gray-300 ${
                  compact ? 'text-xl' : 'text-3xl'
                }`}
                placeholder="未命名卡片"
                value={title}
                onChange={(e) => {
                  const next = e.target.value
                  setTitle(next)
                  scheduleTitleSave(() => void updateCard(card.id, { title: next }))
                }}
              />
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
        <div className={hideTitle ? 'journal-editor' : 'mt-4'}>
          <EditorContent editor={editor} />
        </div>
        <BacklinksPanel cardId={card.id} />
      </div>
    </div>
  )
}
