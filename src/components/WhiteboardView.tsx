import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Background,
  MarkerType,
  MiniMap,
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
import type { BoardEdge, BoardNote, CardInstance, Section } from '../types'
import { boardItemsRepository } from '../db/whiteboardRepository'
import { useCardStore } from '../store/useCardStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import { CardNode, type CardNodeType } from './CardNode'
import { SectionNode, type SectionNodeType } from './SectionNode'
import { StickyNode, type StickyNodeType } from './StickyNode'
import { CardEditor } from './CardEditor'

const nodeTypes = { card: CardNode, section: SectionNode, sticky: StickyNode }

type BoardNode = CardNodeType | SectionNodeType | StickyNodeType

function toCardNode(instance: CardInstance): CardNodeType {
  return {
    id: instance.id,
    type: 'card',
    position: { x: instance.x, y: instance.y },
    width: instance.width,
    height: instance.height || undefined,
    data: { cardId: instance.cardId, color: instance.color },
  }
}

function toStickyNode(note: BoardNote): StickyNodeType {
  return {
    id: note.id,
    type: 'sticky',
    position: { x: note.x, y: note.y },
    width: note.width,
    height: note.height,
    data: { text: note.text },
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

function nodeCenter(node: Node): { x: number; y: number } {
  const width = node.measured?.width ?? node.width ?? 280
  const height = node.measured?.height ?? node.height ?? 80
  return { x: node.position.x + width / 2, y: node.position.y + height / 2 }
}

function centerInRect(node: Node, rect: { x: number; y: number; width: number; height: number }) {
  const c = nodeCenter(node)
  return c.x >= rect.x && c.x <= rect.x + rect.width && c.y >= rect.y && c.y <= rect.y + rect.height
}

function Canvas({ boardId }: { boardId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<BoardNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  // move-together 需要區域拖曳前的位置與大小
  const sectionsRef = useRef(new Map<string, Section>())
  const { screenToFlowPosition } = useReactFlow()

  const boards = useWhiteboardStore((s) => s.boards)
  const board = boards.find((b) => b.id === boardId)
  const cards = useCardStore((s) => s.cards)
  const createCardInStore = useCardStore((s) => s.createCard)
  const editingCard = cards.find((c) => c.id === editingCardId) ?? null

  const handleSectionRectChange = useCallback(
    (id: string, rect: { x: number; y: number; width: number; height: number }) => {
      const prev = sectionsRef.current.get(id)
      if (prev) sectionsRef.current.set(id, { ...prev, ...rect })
    },
    [],
  )

  const handleSectionRename = useCallback((id: string, name: string) => {
    void boardItemsRepository.updateSection(id, { name })
    setNodes((nds) =>
      nds.map((n) => (n.id === id && n.type === 'section' ? { ...n, data: { ...n.data, name } } : n)),
    )
  }, [setNodes])

  const toSectionNode = useCallback(
    (section: Section): SectionNodeType => ({
      id: section.id,
      type: 'section',
      position: { x: section.x, y: section.y },
      width: section.width,
      height: section.height,
      zIndex: -1,
      data: {
        name: section.name,
        onRectChange: handleSectionRectChange,
        onRename: handleSectionRename,
      },
    }),
    [handleSectionRectChange, handleSectionRename],
  )

  useEffect(() => {
    let cancelled = false
    void boardItemsRepository.listByBoard(boardId).then(({ instances, edges, sections, notes }) => {
      if (cancelled) return
      sectionsRef.current = new Map(sections.map((s) => [s.id, s]))
      setNodes([
        ...sections.map(toSectionNode),
        ...notes.map(toStickyNode),
        ...instances.map(toCardNode),
      ])
      setEdges(edges.map(toFlowEdge))
    })
    return () => {
      cancelled = true
    }
  }, [boardId, setNodes, setEdges, toSectionNode])

  const handleNodesChange = useCallback(
    (changes: NodeChange<BoardNode>[]) => {
      for (const change of changes) {
        if (change.type !== 'remove') continue
        const node = nodes.find((n) => n.id === change.id)
        if (node?.type === 'section') {
          sectionsRef.current.delete(change.id)
          void boardItemsRepository.removeSection(change.id)
        } else if (node?.type === 'sticky') {
          void boardItemsRepository.removeNote(change.id)
        } else {
          void boardItemsRepository.removeInstance(change.id)
          setEdges((eds) => eds.filter((e) => e.source !== change.id && e.target !== change.id))
        }
      }
      onNodesChange(changes)
    },
    [nodes, onNodesChange, setEdges],
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
      const draggedIds = new Set(dragged.map((n) => n.id))
      for (const node of dragged) {
        if (node.type === 'section') {
          const prev = sectionsRef.current.get(node.id)
          if (prev) {
            const dx = node.position.x - prev.x
            const dy = node.position.y - prev.y
            if (dx !== 0 || dy !== 0) {
              // 把中心點在區域內、且沒被一起拖曳的卡片/便利貼搬過去
              const contained = nodes.filter(
                (n) => n.type !== 'section' && !draggedIds.has(n.id) && centerInRect(n, prev),
              )
              if (contained.length > 0) {
                const movedIds = new Set(contained.map((n) => n.id))
                setNodes((nds) =>
                  nds.map((n) =>
                    movedIds.has(n.id)
                      ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
                      : n,
                  ),
                )
                for (const n of contained) {
                  const x = n.position.x + dx
                  const y = n.position.y + dy
                  if (n.type === 'sticky') void boardItemsRepository.updateNote(n.id, { x, y })
                  else void boardItemsRepository.moveInstance(n.id, x, y)
                }
              }
            }
            sectionsRef.current.set(node.id, { ...prev, x: node.position.x, y: node.position.y })
          }
          void boardItemsRepository.updateSection(node.id, {
            x: node.position.x,
            y: node.position.y,
          })
        } else if (node.type === 'sticky') {
          void boardItemsRepository.updateNote(node.id, {
            x: node.position.x,
            y: node.position.y,
          })
        } else {
          void boardItemsRepository.moveInstance(node.id, node.position.x, node.position.y)
        }
      }
    },
    [nodes, setNodes],
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
      const label = window.prompt(
        '連線標籤（留空移除）',
        typeof edge.label === 'string' ? edge.label : '',
      )
      if (label === null) return
      const value = label.trim() || null
      void boardItemsRepository.updateEdgeLabel(edge.id, value)
      setEdges((eds) => eds.map((e) => (e.id === edge.id ? { ...e, label: value ?? undefined } : e)))
    },
    [setEdges],
  )

  const addInstance = useCallback(
    async (cardId: string, x: number, y: number) => {
      const instance = await boardItemsRepository.addInstance(boardId, cardId, x, y)
      setNodes((nds) => [...nds, toCardNode(instance)])
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

  const centerPos = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
  }, [screenToFlowPosition])

  const handleAddCard = useCallback(() => {
    const pos = centerPos()
    void createCardAt(pos.x, pos.y)
  }, [centerPos, createCardAt])

  const handleAddSticky = useCallback(async () => {
    const pos = centerPos()
    const note = await boardItemsRepository.addNote(boardId, pos.x, pos.y)
    setNodes((nds) => [...nds, toStickyNode(note)])
  }, [boardId, centerPos, setNodes])

  const handleAddSection = useCallback(async () => {
    const pos = centerPos()
    const section = await boardItemsRepository.addSection(boardId, pos.x - 210, pos.y - 150)
    sectionsRef.current.set(section.id, section)
    setNodes((nds) => [toSectionNode(section), ...nds])
  }, [boardId, centerPos, setNodes, toSectionNode])

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
            onClick={handleAddCard}
            className="rounded-md bg-gray-900 px-2 py-0.5 text-xs font-medium text-white hover:bg-gray-700"
          >
            ＋ 新卡片
          </button>
          <button
            type="button"
            onClick={() => void handleAddSticky()}
            className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
          >
            ＋ 便利貼
          </button>
          <button
            type="button"
            onClick={() => void handleAddSection()}
            className="rounded-md border border-violet-300 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
          >
            ＋ 區域
          </button>
          <span className="text-xs text-gray-400">雙擊空白處新增卡片</span>
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
          onNodeDoubleClick={(_, node) => {
            if (node.type === 'card') setEditingCardId((node as CardNodeType).data.cardId)
          }}
          zoomOnDoubleClick={false}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          minZoom={0.1}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} />
          <MiniMap pannable zoomable className="!h-28 !w-40" />
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
