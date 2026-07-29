import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getBezierPath,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
} from '@xyflow/react'

// 連線（#5 接同邊、本輪修正：精準接到卡片左右兩側的「連接點」）。
// 卡片的連接點固定在左右兩側的垂直中點；這裡讓線的端點也落在同樣位置，
// 依兩張卡片的左右相對位置選擇要接哪一側，線就會剛好接在圓點上，不會歪掉。

function centerX(node: InternalNode): number {
  return node.internals.positionAbsolute.x + (node.measured.width ?? 0) / 2
}

// 回傳指定側邊（左/右）中點座標
function sidePoint(node: InternalNode, side: Position): { x: number; y: number } {
  const x = node.internals.positionAbsolute.x
  const y = node.internals.positionAbsolute.y
  const w = node.measured.width ?? 0
  const h = node.measured.height ?? 0
  return { x: side === Position.Right ? x + w : x, y: y + h / 2 }
}

export function FloatingEdge({ id, source, target, markerEnd, markerStart, style, label }: EdgeProps) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  if (!sourceNode || !targetNode) return null

  // 來源在左 → 從右側連接點出、接到目標左側連接點；反之亦然
  const sourceIsLeft = centerX(sourceNode) <= centerX(targetNode)
  const sPos = sourceIsLeft ? Position.Right : Position.Left
  const tPos = sourceIsLeft ? Position.Left : Position.Right
  const sp = sidePoint(sourceNode, sPos)
  const tp = sidePoint(targetNode, tPos)

  const [path, labelX, labelY] = getBezierPath({
    sourceX: sp.x,
    sourceY: sp.y,
    sourcePosition: sPos,
    targetPosition: tPos,
    targetX: tp.x,
    targetY: tp.y,
  })

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} markerStart={markerStart} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="board-edge-label nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
