import { memo, useMemo, useState } from 'react'
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

// 折疊狀態屬於「白板上的檢視偏好」，用 localStorage 存（不進雲端同步）
const COLLAPSE_KEY = 'notebook-card-collapsed'
function loadCollapsed(id: string): boolean {
  try {
    return localStorage.getItem(`${COLLAPSE_KEY}:${id}`) === '1'
  } catch {
    return false
  }
}
function saveCollapsed(id: string, v: boolean): void {
  try {
    if (v) localStorage.setItem(`${COLLAPSE_KEY}:${id}`, '1')
    else localStorage.removeItem(`${COLLAPSE_KEY}:${id}`)
  } catch {
    /* 忽略（無痕模式等） */
  }
}

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
  const { updateNodeData, deleteElements } = useReactFlow()
  const [collapsed, setCollapsed] = useState(() => loadCollapsed(id))

  const html = useMemo(() => {
    if (!card) return ''
    try {
      return generateHTML(card.content as JSONContent, baseExtensions)
    } catch {
      return ''
    }
  }, [card])

  const color = CARD_COLORS.find((c) => c.key === data.color) ?? CARD_COLORS[0]

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c
      saveCollapsed(id, next)
      return next
    })
  }

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
          <span className="card-toolbar-sep" />
          <button
            type="button"
            aria-label="從白板移除此卡片"
            title="從白板移除（不刪卡片）"
            onClick={(e) => {
              e.stopPropagation()
              void deleteElements({ nodes: [{ id }] })
            }}
            className="card-toolbar-remove"
          >
            🗑
          </button>
        </div>
      </NodeToolbar>
      {/* 折疊時鎖高度（只露標題）；展開時才可自由縮放 */}
      <NodeResizer
        isVisible={selected && !collapsed}
        minWidth={160}
        minHeight={60}
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
        className={`card-node ${collapsed ? 'is-collapsed' : ''} ${selected ? 'is-selected' : ''}`}
        style={{ background: color.bg, borderColor: selected ? undefined : color.border }}
      >
        <div className="card-node-header">
          <button
            type="button"
            className="card-node-collapse nodrag"
            aria-label={collapsed ? '展開卡片' : '收合卡片'}
            title={collapsed ? '展開' : '只露出標題'}
            onClick={(e) => {
              e.stopPropagation()
              toggleCollapse()
            }}
          >
            {collapsed ? '▸' : '▾'}
          </button>
          <div className="card-node-title">
            {card ? card.title || '未命名卡片' : '已刪除的卡片'}
          </div>
        </div>
        {!collapsed && html && (
          /* 內容為使用者自己在編輯器輸入、經 schema 正規化的 JSON，非外部來源。
             nowheel：讓滑鼠滾輪捲動內文而非縮放畫布（#5 長文可上下捲）。 */
          <div
            className="tiptap card-node-body nowheel"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
      <Handle type="source" position={Position.Right} className="card-node-handle" />
    </>
  )
})
