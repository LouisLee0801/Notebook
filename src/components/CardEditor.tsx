import { useEffect, useMemo, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import type { Content } from '@tiptap/core'
import type { Card } from '../types'
import { useCardStore } from '../store/useCardStore'
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

export function CardEditor({ card }: { card: Card }) {
  const updateCard = useCardStore((s) => s.updateCard)
  const scheduleSave = useDebouncedSave()

  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight,
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
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
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        <input
          className="w-full bg-transparent text-3xl font-bold outline-none placeholder:text-gray-300"
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
