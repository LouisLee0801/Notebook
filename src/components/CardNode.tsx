import { memo, useMemo } from 'react'
import {
  Handle,
  NodeResizer,
  NodeToolbar,
  Position,
  useReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { generateHTML, type JSONContent } from '@tiptap/core'
import { baseExtensions } from '../editor/extensions'
import { useCardStore } from '../store/useCardStore'
import { boardItemsRepository } from '../db/whiteboardRepository'

export type CardNodeType = Node<{ cardId: string; color: string | null }, 'card'>

// 卡片顏色（features.md 模組 3 P1）：顏色屬於白板上的實例，不影響卡片本身
export const CARD_COLORS: { key: string | null; label: string; bg: string; border: string }[] = [
  { key: null, label: '白', bg: '#ffffff', border: '#e5e7eb' },
  { key: 'red', label: '紅', bg: '#fef2f2', border: '#fecaca' },
  { key: 'amber', label: '黃', bg: '#fffbeb', border: '#fde68a' },
  { key: 'green', label: '綠', bg: '#f0fdf4', border: '#bbf7d0' },
  { key: 'blue', label: '藍', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'purple', label: '紫', bg: '#faf5ff', border: '#e9d5ff' },
]

export const CardNode = memo(function CardNode({ id, data, selected }: NodeProps<CardNodeType>) {
  const card = useCardStore((s) => s.cards.find((c) => c.id === data.cardId))
  const { updateNodeData } = useReactFlow()

  const html = useMemo(() => {
    if (!card) return ''
    try {
      return generateHTML(card.content as JSONContent, baseExtensions)
    } catch {
      return ''
    }
  }, [card])

  const color = CARD_COLORS.find((c) => c.key === data.color) ?? CARD_COLORS[0]

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
        <div className="card-color-toolbar">
          {CARD_COLORS.map((c) => (
            <button
              key={c.key ?? 'none'}
              type="button"
              title={c.label}
              aria-label={`卡片顏色 ${c.label}`}
              onClick={() => {
                void boardItemsRepository.setInstanceColor(id, c.key)
                updateNodeData(id, { color: c.key })
              }}
              style={{ background: c.bg, borderColor: c.border }}
              className={`card-color-swatch ${data.color === c.key ? 'is-active' : ''}`}
            />
          ))}
        </div>
      </NodeToolbar>
      <NodeResizer
        isVisible={selected}
        minWidth={180}
        minHeight={48}
        lineClassName="!border-blue-400"
        handleClassName="!bg-blue-400"
        onResizeEnd={(_, params) =>
          void boardItemsRepository.resizeInstance(id, {
            x: params.x,
            y: params.y,
            width: params.width,
            height: params.height,
          })
        }
      />
      <Handle type="target" position={Position.Left} className="card-node-handle" />
      <div
        className={`card-node ${selected ? 'is-selected' : ''}`}
        style={{ background: color.bg, borderColor: selected ? undefined : color.border }}
      >
        <div className="card-node-title">{card ? card.title || '未命名卡片' : '已刪除的卡片'}</div>
        {html && (
          /* 內容為使用者自己在編輯器輸入、經 schema 正規化的 JSON，非外部來源 */
          <div className="tiptap card-node-body" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
      <Handle type="source" position={Position.Right} className="card-node-handle" />
    </>
  )
})
