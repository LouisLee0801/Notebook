import { memo, useCallback, useEffect, useReducer, useRef } from 'react'
import {
  NodeResizer,
  NodeToolbar,
  Position,
  useReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { boardItemsRepository } from '../db/whiteboardRepository'
import { useBoardNotesStore } from '../store/useBoardNotesStore'

export type StickyNodeType = Node<{ text: string }, 'sticky'>

// 便利貼支援的文字色（#10）
const STICKY_COLORS = ['#dc2626', '#ea580c', '#16a34a', '#2563eb', '#7c3aed', '#713f12']

// 便利貼專屬輕量編輯器：基本格式 + 螢光 + 文字色（不含標題/清單等重量級功能）
const stickyExtensions = [
  StarterKit.configure({ heading: false }),
  Underline,
  Highlight.configure({ multicolor: true }),
  TextStyle,
  Color,
]

// 選取便利貼後出現的小工具列（#10 變換文字格式與顏色）
function StickyToolbar({ editor }: { editor: Editor }) {
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
    // 按工具列不要奪走編輯器選取
    <div className="sticky-toolbar" onMouseDown={(e) => e.preventDefault()}>
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
      {STICKY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`文字顏色 ${c}`}
          title="文字顏色"
          className="sticky-swatch"
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
  )
}

// 便利貼（features.md 模組 3 P1）：白板專屬輕量文字，不入卡片庫。
// 未選取時顯示已格式化的內容（整個節點可拖曳、可縮放）；點選後可編輯並跳出格式工具列。
export const StickyNode = memo(function StickyNode({
  id,
  data,
  selected,
}: NodeProps<StickyNodeType>) {
  const { deleteElements } = useReactFlow()
  // 內文以 HTML 存於 note.text（舊的純文字也是合法 HTML，向下相容）
  const htmlRef = useRef(data.text)

  const editor = useEditor(
    {
      extensions: stickyExtensions,
      content: data.text,
      editable: selected,
      onUpdate: ({ editor }) => {
        htmlRef.current = editor.getHTML()
      },
    },
    [id],
  )

  const save = useCallback(() => {
    void boardItemsRepository
      .updateNote(id, { text: htmlRef.current })
      .then(() => useBoardNotesStore.getState().load())
  }, [id])

  // 選取狀態切換可否編輯；失焦即存檔
  useEffect(() => {
    if (!editor) return
    editor.setEditable(selected)
    editor.on('blur', save)
    return () => {
      editor.off('blur', save)
    }
  }, [editor, selected, save])

  // 取消選取（本輪編輯結束）時補存一次
  useEffect(() => {
    if (!selected) return
    return () => save()
  }, [selected, save])

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top} offset={6}>
        {editor && <StickyToolbar editor={editor} />}
      </NodeToolbar>
      <NodeToolbar isVisible={selected} position={Position.Bottom} offset={6}>
        <button
          type="button"
          aria-label="刪除便利貼"
          onClick={() => void deleteElements({ nodes: [{ id }] })}
          className="node-delete-btn"
        >
          🗑 刪除
        </button>
      </NodeToolbar>
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={80}
        lineClassName="!border-amber-400"
        handleClassName="!bg-amber-400"
        onResizeEnd={(_, params) =>
          void boardItemsRepository.updateNote(id, {
            x: params.x,
            y: params.y,
            width: params.width,
            height: params.height,
          })
        }
      />
      {/* 選取時加 nodrag/nowheel：可選字、可捲動；未選取時整塊可拖曳 */}
      <div className={`sticky-node ${selected ? 'is-editing nodrag nowheel' : ''}`}>
        <EditorContent editor={editor} className="sticky-node-content" />
      </div>
    </>
  )
})
