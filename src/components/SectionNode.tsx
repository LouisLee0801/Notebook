import { memo } from 'react'
import {
  NodeResizer,
  NodeToolbar,
  Position,
  useReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { boardItemsRepository } from '../db/whiteboardRepository'

export type SectionNodeType = Node<
  {
    name: string
    onRectChange: (id: string, rect: { x: number; y: number; width: number; height: number }) => void
    onRename: (id: string, name: string) => void
  },
  'section'
>

// 白板上的具名區域（features.md 模組 3 P1）：
// 半透明底、可縮放；拖曳整個區域時，Canvas 會把「中心點落在區域內」的卡片一起搬移
export const SectionNode = memo(function SectionNode({
  id,
  data,
  selected,
}: NodeProps<SectionNodeType>) {
  const { deleteElements } = useReactFlow()

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top} offset={6}>
        <div className="section-toolbar">
          <button
            type="button"
            onClick={() => {
              const name = window.prompt('區域名稱', data.name)
              if (name?.trim()) data.onRename(id, name.trim())
            }}
            className="node-tool-btn"
          >
            重新命名
          </button>
          <button
            type="button"
            aria-label="刪除區域"
            onClick={() => void deleteElements({ nodes: [{ id }] })}
            className="node-delete-btn"
          >
            🗑 刪除區域
          </button>
        </div>
      </NodeToolbar>
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={120}
        lineClassName="!border-violet-400"
        handleClassName="!bg-violet-400"
        onResizeEnd={(_, params) => {
          const rect = { x: params.x, y: params.y, width: params.width, height: params.height }
          void boardItemsRepository.updateSection(id, rect)
          data.onRectChange(id, rect)
        }}
      />
      <div className={`section-node ${selected ? 'is-selected' : ''}`}>
        <div
          className="section-node-name"
          onDoubleClick={(e) => {
            e.stopPropagation()
            const name = window.prompt('區域名稱', data.name)
            if (name?.trim()) data.onRename(id, name.trim())
          }}
        >
          {data.name}
        </div>
      </div>
    </>
  )
})
