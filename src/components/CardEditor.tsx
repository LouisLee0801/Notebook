import { useEffect, useMemo, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import type { Content } from '@tiptap/core'
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
  const scheduleSave = useDebouncedSave()

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
        scheduleSave(() => void updateCard(card.id, { content: json }))
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
                value={card.title}
                onChange={(e) => void updateCard(card.id, { title: e.target.value })}
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
