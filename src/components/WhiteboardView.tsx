import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Background,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { BoardEdge, CardInstance } from '../types'
import { boardItemsRepository } from '../db/whiteboardRepository'
import { useCardStore } from '../store/useCardStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import { CardNode, type CardNodeType } from './CardNode'
import { CardEditor } from './CardEditor'

const nodeTypes = { card: CardNode }

function toNode(instance: CardInstance): CardNodeType {
  return {
    id: instance.id,
    type: 'card',
    position: { x: instance.x, y: instance.y },
    width: instance.width,
    height: instance.height || undefined,
    data: { cardId: instance.cardId },
  }
}

function toFlowEdge(edge: BoardEdge): Edge {
  return {
    id: edge.id,
    source: edge.fromInstanceId,
    target: edge.toInstanceId,
    label: edge.label ?? undefined,
    markerEnd: edge.arrow !== 'none' ? { type: MarkerType.ArrowClosed } : undefined,
    markerStart: edge.arrow === 'both' ? { type: MarkerType.ArrowClosed } : undefined,
  }
}

function Canvas({ boardId }: { boardId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CardNodeType>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

  const boards = useWhiteboardStore((s) => s.boards)
  const board = boards.find((b) => b.id === boardId)
  const cards = useCardStore((s) => s.cards)
  const createCardInStore = useCardStore((s) => s.createCard)
  const editingCard = cards.find((c) => c.id === editingCardId) ?? null

  useEffect(() => {
    let cancelled = false
    void boardItemsRepository.listByBoard(boardId).then(({ instances, edges }) => {
      if (cancelled) return
      setNodes(instances.map(toNode))
      setEdges(edges.map(toFlowEdge))
    })
    return () => {
      cancelled = true
    }
  }, [boardId, setNodes, setEdges])

  const handleNodesChange = useCallback(
    (changes: NodeChange<CardNodeType>[]) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          void boardItemsRepository.removeInstance(change.id)
          setEdges((eds) => eds.filter((e) => e.source !== change.id && e.target !== change.id))
        }
      }
      onNodesChange(changes)
    },
    [onNodesChange, setEdges],
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      for (const change of changes) {
        if (change.type === 'remove') void boardItemsRepository.removeEdge(change.id)
      }
      onEdgesChange(changes)
    },
    [onEdgesChange],
  )

  const handleNodeDragStop = useCallback(
    (_: unknown, __: Node, dragged: Node[]) => {
      for (const node of dragged) {
        void boardItemsRepository.moveInstance(node.id, node.position.x, node.position.y)
      }
    },
    [],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      const edge: BoardEdge = {
        id: crypto.randomUUID(),
        whiteboardId: boardId,
        fromInstanceId: connection.source,
        toInstanceId: connection.target,
        label: null,
        arrow: 'forward',
      }
      void boardItemsRepository.addEdge(edge)
      setEdges((eds) => [...eds, toFlowEdge(edge)])
    },
    [boardId, setEdges],
  )

  const handleEdgeDoubleClick = useCallback(
    (_: unknown, edge: Edge) => {
      const label = window.prompt('連線標籤（留空移除）', typeof edge.label === 'string' ? edge.label : '')
      if (label === null) return
      const value = label.trim() || null
      void boardItemsRepository.updateEdgeLabel(edge.id, value)
      setEdges((eds) =>
        eds.map((e) => (e.id === edge.id ? { ...e, label: value ?? undefined } : e)),
      )
    },
    [setEdges],
  )

  const addInstance = useCallback(
    async (cardId: string, x: number, y: number) => {
      const instance = await boardItemsRepository.addInstance(boardId, cardId, x, y)
      setNodes((nds) => [...nds, toNode(instance)])
    },
    [boardId, setNodes],
  )

  const createCardAt = useCallback(
    async (x: number, y: number) => {
      const card = await createCardInStore()
      await addInstance(card.id, x, y)
      setEditingCardId(card.id)
    },
    [createCardInStore, addInstance],
  )

  const handlePaneDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!(e.target as HTMLElement).classList.contains('react-flow__pane')) return
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      void createCardAt(pos.x, pos.y)
    },
    [screenToFlowPosition, createCardAt],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      const cardId = e.dataTransfer.getData('application/x-notebook-card')
      if (!cardId) return
      e.preventDefault()
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      void addInstance(cardId, pos.x, pos.y)
    },
    [screenToFlowPosition, addInstance],
  )

  const handleAddAtCenter = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    const pos = screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
    void createCardAt(pos.x, pos.y)
  }, [screenToFlowPosition, createCardAt])

  return (
    <div className="flex h-full">
      <div
        ref={wrapperRef}
        className="relative min-w-0 flex-1"
        onDoubleClick={handlePaneDoubleClick}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={handleDrop}
      >
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-lg border border-gray-200 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur">
          <span className="text-sm font-semibold text-gray-800">{board?.name ?? '白板'}</span>
          <button
            type="button"
            onClick={handleAddAtCenter}
            className="rounded-md bg-gray-900 px-2 py-0.5 text-xs font-medium text-white hover:bg-gray-700"
          >
            ＋ 新卡片
          </button>
          <span className="text-xs text-gray-400">雙擊空白處新增．拖線連接卡片</span>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onConnect={handleConnect}
          onEdgeDoubleClick={handleEdgeDoubleClick}
          onNodeDoubleClick={(_, node) => setEditingCardId(node.data.cardId)}
          zoomOnDoubleClick={false}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          minZoom={0.1}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} />
        </ReactFlow>
      </div>

      {editingCard && (
        <div className="flex w-96 shrink-0 flex-col border-l border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
            <span className="text-xs font-semibold text-gray-500">編輯卡片</span>
            <button
              type="button"
              aria-label="關閉編輯"
              onClick={() => setEditingCardId(null)}
              className="rounded px-1.5 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <CardEditor key={editingCard.id} card={editingCard} compact />
          </div>
        </div>
      )}
    </div>
  )
}

export function WhiteboardView({ boardId }: { boardId: string }) {
  return (
    <ReactFlowProvider>
      <Canvas key={boardId} boardId={boardId} />
    </ReactFlowProvider>
  )
}
