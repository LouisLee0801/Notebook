import { useEffect, useMemo, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import type { Content } from '@tiptap/core'
import type { Card } from '../types'
import { useCardStore } from '../store/useCardStore'
import { baseExtensions } from '../editor/extensions'
import { SlashMenu } from '../editor/slashMenu'

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

export function CardEditor({ card, compact = false }: { card: Card; compact?: boolean }) {
  const updateCard = useCardStore((s) => s.updateCard)
  const scheduleSave = useDebouncedSave()

  const extensions = useMemo(
    () => [
      ...baseExtensions,
      Placeholder.configure({ placeholder: '輸入內容，「/」呼叫區塊選單…' }),
      SlashMenu,
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
    },
    [card.id],
  )

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className={compact ? 'w-full px-5 py-5' : 'mx-auto w-full max-w-3xl px-8 py-10'}>
        <input
          className={`w-full bg-transparent font-bold outline-none placeholder:text-gray-300 ${
            compact ? 'text-xl' : 'text-3xl'
          }`}
          placeholder="未命名卡片"
          value={card.title}
          onChange={(e) => void updateCard(card.id, { title: e.target.value })}
        />
        <div className="mt-4">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
