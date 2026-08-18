import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Handle,
  NodeResizeControl,
  NodeResizer,
  NodeToolbar,
  Position,
  useReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { generateHTML, type JSONContent } from '@tiptap/core'
import { baseExtensions } from '../editor/extensions'
import { titleHtmlOrNull } from '../editor/titleFormat'
import { useCardStore } from '../store/useCardStore'
import { useBoardHistoryStore } from '../store/useBoardHistoryStore'
import { boardItemsRepository } from '../db/whiteboardRepository'

export type CardNodeType = Node<
  // expandedHeight：收合前的高度，展開時原樣還原（#3）
  { cardId: string; color: string | null; autoHeight?: boolean; expandedHeight?: number },
  'card'
>

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
  const { updateNodeData, updateNode, getNode, deleteElements } = useReactFlow()
  const [collapsed, setCollapsed] = useState(() => loadCollapsed(id))
  const pushHistory = useBoardHistoryStore((s) => s.push)

  /** 縮放與換色也要能「上一步」（#4） */
  const applySize = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      updateNode(id, {
        position: { x: rect.x, y: rect.y },
        width: rect.width,
        height: rect.height || undefined,
      })
      updateNodeData(id, { autoHeight: !rect.height, expandedHeight: rect.height || undefined })
      void boardItemsRepository.resizeInstance(id, rect)
    },
    [id, updateNode, updateNodeData],
  )

  const pushResize = useCallback(
    (before: { x: number; y: number; width: number; height: number }, after: { x: number; y: number; width: number; height: number }) => {
      pushHistory({
        label: '調整卡片大小',
        undo: () => applySize(before),
        redo: () => applySize(after),
      })
    },
    [applySize, pushHistory],
  )

  /** 縮放前的位置與尺寸（用來記錄上一步） */
  const sizeBefore = useCallback(() => {
    const node = getNode(id)
    return {
      x: node?.position.x ?? 0,
      y: node?.position.y ?? 0,
      width: node?.width ?? node?.measured?.width ?? 280,
      height: node?.height ?? 0,
    }
  }, [getNode, id])

  // #3 收合時把節點高度交還給「依內容自動」，否則 React Flow 仍以展開時的高度
  // 計算連接點，連線就會接到卡片下方的空白處。展開時再還原原本的高度。
  const applyCollapsedHeight = useCallback(
    (isCollapsed: boolean) => {
      const node = getNode(id)
      if (!node) return
      if (isCollapsed) {
        const height = node.height ?? node.measured?.height
        if (node.height) updateNodeData(id, { expandedHeight: node.height })
        else if (height) updateNodeData(id, { expandedHeight: undefined })
        updateNode(id, { height: undefined })
      } else {
        const restored = (getNode(id)?.data as CardNodeType['data'] | undefined)?.expandedHeight
        updateNode(id, { height: restored })
      }
    },
    [getNode, id, updateNode, updateNodeData],
  )

  const resizeBefore = useRef({ x: 0, y: 0, width: 280, height: 0 })

  // 開啟白板時就是收合狀態的卡片，也要套用一次（收合狀態記在 localStorage）
  const appliedOnMount = useRef(false)
  useEffect(() => {
    if (appliedOnMount.current || !collapsed) return
    appliedOnMount.current = true
    applyCollapsedHeight(true)
  }, [collapsed, applyCollapsedHeight])

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
    const next = !collapsed
    setCollapsed(next)
    saveCollapsed(id, next)
    applyCollapsedHeight(next)
  }

  /** 收合時只調寬度：位置與寬度存檔，高度沿用收合前的值（#2） */
  const persistWidth = useCallback(
    (before: { x: number; y: number; width: number; height: number }, params: { x: number; y: number; width: number }) => {
      const stored = (getNode(id)?.data as CardNodeType['data'] | undefined)?.expandedHeight ?? 0
      const after = { x: params.x, y: params.y, width: params.width, height: stored }
      updateNode(id, { height: undefined })
      void boardItemsRepository.resizeInstance(id, after)
      if (before.width !== after.width || before.x !== after.x) {
        pushHistory({
          label: '調整卡片寬度',
          undo: () => {
            updateNode(id, { position: { x: before.x, y: before.y }, width: before.width, height: undefined })
            void boardItemsRepository.resizeInstance(id, before)
          },
          redo: () => {
            updateNode(id, { position: { x: after.x, y: after.y }, width: after.width, height: undefined })
            void boardItemsRepository.resizeInstance(id, after)
          },
        })
      }
    },
    [getNode, id, pushHistory, updateNode],
  )

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
                const before = data.color
                if (before === c.key) return
                const setColor = (color: string | null) => {
                  void boardItemsRepository.setInstanceColor(id, color)
                  updateNodeData(id, { color })
                }
                setColor(c.key)
                pushHistory({
                  label: '換卡片顏色',
                  undo: () => setColor(before),
                  redo: () => setColor(c.key),
                })
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
      {/* 展開時可自由縮放；收合時只給左右把手調寬度（#2，高度維持只露標題） */}
      {collapsed ? (
        selected && (
          <>
            <NodeResizeControl
              position="left"
              minWidth={160}
              className="card-width-control"
              onResizeStart={() => { resizeBefore.current = sizeBefore() }}
              onResizeEnd={(_, params) => persistWidth(resizeBefore.current, params)}
            />
            <NodeResizeControl
              position="right"
              minWidth={160}
              className="card-width-control"
              onResizeStart={() => { resizeBefore.current = sizeBefore() }}
              onResizeEnd={(_, params) => persistWidth(resizeBefore.current, params)}
            />
          </>
        )
      ) : (
        <NodeResizer
          isVisible={selected}
          minWidth={160}
          minHeight={60}
          lineClassName="!border-blue-400"
          handleClassName="!bg-blue-400"
          onResizeStart={() => {
            resizeBefore.current = sizeBefore()
          }}
          onResizeEnd={(_, params) => {
            // 手動調過大小後就以固定高度顯示（內文改為填滿並可捲動，不再套用自動高度上限）
            const after = { x: params.x, y: params.y, width: params.width, height: params.height }
            updateNodeData(id, { autoHeight: false, expandedHeight: params.height })
            void boardItemsRepository.resizeInstance(id, after)
            pushResize(resizeBefore.current, after)
          }}
        />
      )}
      <Handle type="target" position={Position.Left} className="card-node-handle" />
      <div
        className={`card-node ${collapsed ? 'is-collapsed' : ''} ${
          data.autoHeight ? 'is-autosize' : ''
        } ${selected ? 'is-selected' : ''}`}
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
          {(() => {
            if (!card) return <div className="card-node-title">已刪除的卡片</div>
            // 優先用已同步的 card.titleHtml，其次相容舊的本機格式
            const titleHtml = card.title.trim()
              ? card.titleHtml || titleHtmlOrNull(card.id, card.title)
              : null
            if (titleHtml) {
              // 標題 HTML 由標題編輯器輸出、經 schema 正規化，非外部來源
              return (
                <div
                  className="card-node-title"
                  dangerouslySetInnerHTML={{ __html: titleHtml }}
                />
              )
            }
            return <div className="card-node-title">{card.title || '未命名卡片'}</div>
          })()}
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
