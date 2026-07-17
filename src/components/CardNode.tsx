import { memo, useMemo } from 'react'
import { Handle, NodeResizer, Position, type Node, type NodeProps } from '@xyflow/react'
import { generateHTML, type JSONContent } from '@tiptap/core'
import { baseExtensions } from '../editor/extensions'
import { useCardStore } from '../store/useCardStore'
import { boardItemsRepository } from '../db/whiteboardRepository'

export type CardNodeType = Node<{ cardId: string }, 'card'>

export const CardNode = memo(function CardNode({ id, data, selected }: NodeProps<CardNodeType>) {
  const card = useCardStore((s) => s.cards.find((c) => c.id === data.cardId))

  const html = useMemo(() => {
    if (!card) return ''
    try {
      return generateHTML(card.content as JSONContent, baseExtensions)
    } catch {
      return ''
    }
  }, [card])

  return (
    <>
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
      <div className={`card-node ${selected ? 'is-selected' : ''}`}>
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
