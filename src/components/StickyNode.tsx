import { memo, useEffect, useRef, useState } from 'react'
import {
  NodeResizer,
  NodeToolbar,
  Position,
  useReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { boardItemsRepository } from '../db/whiteboardRepository'
import { useBoardNotesStore } from '../store/useBoardNotesStore'

export type StickyNodeType = Node<{ text: string }, 'sticky'>

// 便利貼（features.md 模組 3 P1）：白板專屬輕量文字，不入卡片庫。
// 未選取時是純文字（整個節點可拖曳），點選後才變成可輸入的 textarea。
export const StickyNode = memo(function StickyNode({
  id,
  data,
  selected,
}: NodeProps<StickyNodeType>) {
  const [text, setText] = useState(data.text)
  const textRef = useRef(text)
  textRef.current = text
  const { deleteElements } = useReactFlow()

  // 取消選取（textarea 卸載）時也要存檔
  useEffect(() => {
    if (!selected) return
    return () => {
      void boardItemsRepository
        .updateNote(id, { text: textRef.current })
        .then(() => useBoardNotesStore.getState().load())
    }
  }, [selected, id])

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top} offset={6}>
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
      {selected ? (
        <textarea
          autoFocus
          className="sticky-node sticky-node-input nodrag"
          value={text}
          placeholder="便利貼…"
          onChange={(e) => setText(e.target.value)}
          onBlur={() =>
            void boardItemsRepository
              .updateNote(id, { text })
              .then(() => useBoardNotesStore.getState().load())
          }
        />
      ) : (
        <div className="sticky-node sticky-node-view">
          {text || <span className="sticky-node-placeholder">便利貼…</span>}
        </div>
      )}
    </>
  )
})
