import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getBezierPath,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
} from '@xyflow/react'

// 浮動連線（#5）：線接到兩張卡片「彼此面對的最近側邊」，
// 不再固定右→左而繞一圈。取兩節點中心連線與節點邊框的交點。

function getNodeIntersection(node: InternalNode, other: InternalNode) {
  const w = (node.measured.width ?? 0) / 2
  const h = (node.measured.height ?? 0) / 2
  const x2 = node.internals.positionAbsolute.x + w
  const y2 = node.internals.positionAbsolute.y + h
  const x1 = other.internals.positionAbsolute.x + (other.measured.width ?? 0) / 2
  const y1 = other.internals.positionAbsolute.y + (other.measured.height ?? 0) / 2
  if (w === 0 || h === 0) return { x: x2, y: y2 }
  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h)
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h)
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1)
  const xx3 = a * xx1
  const yy3 = a * yy1
  return { x: w * (xx3 + yy3) + x2, y: h * (-xx3 + yy3) + y2 }
}

function getEdgePosition(node: InternalNode, point: { x: number; y: number }): Position {
  const nx = Math.round(node.internals.positionAbsolute.x)
  const ny = Math.round(node.internals.positionAbsolute.y)
  const w = node.measured.width ?? 0
  const h = node.measured.height ?? 0
  const px = Math.round(point.x)
  const py = Math.round(point.y)
  if (px <= nx + 1) return Position.Left
  if (px >= nx + w - 1) return Position.Right
  if (py <= ny + 1) return Position.Top
  if (py >= ny + h - 1) return Position.Bottom
  return Position.Top
}

export function FloatingEdge({ id, source, target, markerEnd, markerStart, style, label }: EdgeProps) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  if (!sourceNode || !targetNode) return null

  const sp = getNodeIntersection(sourceNode, targetNode)
  const tp = getNodeIntersection(targetNode, sourceNode)
  const [path, labelX, labelY] = getBezierPath({
    sourceX: sp.x,
    sourceY: sp.y,
    sourcePosition: getEdgePosition(sourceNode, sp),
    targetPosition: getEdgePosition(targetNode, tp),
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
