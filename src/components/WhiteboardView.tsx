import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Background,
  ConnectionMode,
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
  type FinalConnectionState,
  type NodeChange,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { BoardEdge, BoardNote, CardInstance, Section } from '../types'
import { boardItemsRepository } from '../db/whiteboardRepository'
import { useCardStore } from '../store/useCardStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import { useBoardNotesStore } from '../store/useBoardNotesStore'
import { useBoardHistoryStore } from '../store/useBoardHistoryStore'
import { CardNode, type CardNodeType } from './CardNode'
import { SectionNode, type SectionNodeType } from './SectionNode'
import { StickyNode, type StickyNodeType } from './StickyNode'
import { FloatingEdge } from './FloatingEdge'
import { CardEditor } from './CardEditor'

const nodeTypes = { card: CardNode, section: SectionNode, sticky: StickyNode }
const edgeTypes = { floating: FloatingEdge }

type BoardNode = CardNodeType | SectionNodeType | StickyNodeType

function toCardNode(instance: CardInstance): CardNodeType {
  return {
    id: instance.id,
    type: 'card',
    position: { x: instance.x, y: instance.y },
    width: instance.width,
    height: instance.height || undefined,
    // 卡片層級高於便利貼：便利貼疊在卡片上時仍可點選/移動卡片（#7）
    zIndex: 1,
    // 沒有手動調過高度 → 自動高度，超長內文卡片內捲動（#8）
    data: { cardId: instance.cardId, color: instance.color, autoHeight: !instance.height },
  }
}

function toStickyNode(note: BoardNote): StickyNodeType {
  return {
    id: note.id,
    type: 'sticky',
    position: { x: note.x, y: note.y },
    width: note.width,
    height: note.height,
    // #4 便利貼固定在最上層（不被卡片藏住）；仍可點選後刪除
    zIndex: 10000,
    data: { text: note.text },
  }
}

function toFlowEdge(edge: BoardEdge): Edge {
  return {
    id: edge.id,
    source: edge.fromInstanceId,
    target: edge.toInstanceId,
    // #5 浮動連線：自動接到彼此面對的最近側邊，不繞圈
    type: 'floating',
    label: edge.label ?? undefined,
    markerEnd: edge.arrow !== 'none' ? { type: MarkerType.ArrowClosed } : undefined,
    markerStart: edge.arrow === 'both' ? { type: MarkerType.ArrowClosed } : undefined,
  }
}

// 節點在畫布上的實際寬高（手動指定 > 量測 > 預設）
function nodeSize(node: Node): { width: number; height: number } {
  return {
    width: node.measured?.width ?? node.width ?? 280,
    height: node.measured?.height ?? node.height ?? 80,
  }
}

// #4 上一步用的位置快照
interface PosSnapshot {
  id: string
  type: string
  x: number
  y: number
}

function snapshot(nodes: Node[]): PosSnapshot[] {
  return nodes.map((n) => ({ id: n.id, type: n.type ?? 'card', x: n.position.x, y: n.position.y }))
}

/** 依節點種類把座標寫回資料庫 */
function persistPosition(type: string, id: string, x: number, y: number): void {
  if (type === 'sticky') void boardItemsRepository.updateNote(id, { x, y })
  else if (type === 'section') void boardItemsRepository.updateSection(id, { x, y })
  else void boardItemsRepository.moveInstance(id, x, y)
}

function nodeCenter(node: Node): { x: number; y: number } {
  const { width, height } = nodeSize(node)
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
  const { screenToFlowPosition, getViewport, setViewport } = useReactFlow()

  // #4 上一步；#6 框選模式（拖曳即框選，而不是平移畫布）
  const pushHistory = useBoardHistoryStore((s) => s.push)
  const resetHistory = useBoardHistoryStore((s) => s.reset)
  const canUndo = useBoardHistoryStore((s) => s.past.length > 0)
  const canRedo = useBoardHistoryStore((s) => s.future.length > 0)
  const [selectionMode, setSelectionMode] = useState(false)
  // 拖曳開始時的全體位置，拖完才知道誰被移動了（含被區域帶著跑的卡片）
  const dragStartRef = useRef<PosSnapshot[]>([])

  // 換白板就重來一份歷史（歷史只在記憶體，不跨白板）
  useEffect(() => {
    resetHistory()
    return resetHistory
  }, [boardId, resetHistory])

  /** 把一組位置同時套用到畫面與資料庫（上一步/重做/對齊共用） */
  const applyPositions = useCallback(
    (positions: PosSnapshot[]) => {
      const byId = new Map(positions.map((p) => [p.id, p]))
      setNodes((nds) =>
        nds.map((n) => {
          const p = byId.get(n.id)
          return p ? { ...n, position: { x: p.x, y: p.y } } : n
        }),
      )
      for (const p of positions) {
        persistPosition(p.type, p.id, p.x, p.y)
        if (p.type === 'section') {
          const prev = sectionsRef.current.get(p.id)
          if (prev) sectionsRef.current.set(p.id, { ...prev, x: p.x, y: p.y })
        }
      }
    },
    [setNodes],
  )

  /** 位置類操作統一記進歷史 */
  const pushMove = useCallback(
    (label: string, before: PosSnapshot[], after: PosSnapshot[]) => {
      if (before.length === 0) return
      pushHistory({
        label,
        undo: () => applyPositions(before),
        redo: () => applyPositions(after),
      })
    },
    [applyPositions, pushHistory],
  )

  // #2 框選時若拖到視窗邊緣，畫面隨方向自動捲動（Heptabase 式體驗）
  const pointerRef = useRef({ x: 0, y: 0 })
  const panTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pointerMoveOffRef = useRef<(() => void) | null>(null)

  const handleSelectionEnd = useCallback(() => {
    if (panTimerRef.current) {
      clearInterval(panTimerRef.current)
      panTimerRef.current = null
    }
    pointerMoveOffRef.current?.()
    pointerMoveOffRef.current = null
  }, [])

  const handleSelectionStart = useCallback(() => {
    const onMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('pointermove', onMove)
    pointerMoveOffRef.current = () => window.removeEventListener('pointermove', onMove)
    if (panTimerRef.current) clearInterval(panTimerRef.current)
    panTimerRef.current = setInterval(() => {
      const rect = wrapperRef.current?.getBoundingClientRect()
      if (!rect) return
      const EDGE = 56 // 觸發自動捲的邊緣寬度（px）
      const SPEED = 14 // 每次位移上限（px）
      const { x, y } = pointerRef.current
      let dx = 0
      let dy = 0
      if (x < rect.left + EDGE) dx = (rect.left + EDGE - x) / EDGE
      else if (x > rect.right - EDGE) dx = (rect.right - EDGE - x) / EDGE
      if (y < rect.top + EDGE) dy = (rect.top + EDGE - y) / EDGE
      else if (y > rect.bottom - EDGE) dy = (rect.bottom - EDGE - y) / EDGE
      if (dx !== 0 || dy !== 0) {
        const vp = getViewport()
        setViewport({ x: vp.x + dx * SPEED, y: vp.y + dy * SPEED, zoom: vp.zoom })
      }
    }, 16)
  }, [getViewport, setViewport])

  useEffect(() => handleSelectionEnd, [handleSelectionEnd])

  const boards = useWhiteboardStore((s) => s.boards)
  const board = boards.find((b) => b.id === boardId)
  const cards = useCardStore((s) => s.cards)
  const cardsLoaded = useCardStore((s) => s.loaded)
  const createCardInStore = useCardStore((s) => s.createCard)
  const editingCard = cards.find((c) => c.id === editingCardId) ?? null
  const lastRemovedNoteId = useBoardNotesStore((s) => s.lastRemovedId)

  // #4 從卡片庫刪除卡片後，白板上該卡片的節點即時消失（卡片還原時也會隨之回來）
  useEffect(() => {
    if (!cardsLoaded) return
    const live = new Set(cards.map((c) => c.id))
    setNodes((nds) => {
      const next = nds.filter((n) => n.type !== 'card' || live.has((n as CardNodeType).data.cardId))
      return next.length === nds.length ? nds : next
    })
  }, [cards, cardsLoaded, setNodes])

  // #3 從側邊欄清單刪除便利貼後，開著的白板即時移除該便利貼節點
  useEffect(() => {
    if (!lastRemovedNoteId) return
    setNodes((nds) => {
      const next = nds.filter((n) => n.id !== lastRemovedNoteId)
      return next.length === nds.length ? nds : next
    })
  }, [lastRemovedNoteId, setNodes])

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
      // 區域主體不攔截點擊（讓點擊穿透到裡面的卡片/便利貼與畫布）；
      // 僅標題列可互動來選取/拖曳區域 —— 見 SectionNode 的 pointer-events 設定。
      style: { pointerEvents: 'none' },
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

  /** 刪除一個節點（含連帶的線），並回傳可以還原它的函式（#4） */
  const removeNodeWithRestore = useCallback(
    (node: BoardNode): (() => void) => {
      if (node.type === 'section') {
        const section = sectionsRef.current.get(node.id)
        sectionsRef.current.delete(node.id)
        void boardItemsRepository.removeSection(node.id)
        return () => {
          if (!section) return
          sectionsRef.current.set(section.id, section)
          void boardItemsRepository.putSection(section)
          setNodes((nds) => [toSectionNode(section), ...nds])
        }
      }
      if (node.type === 'sticky') {
        const note: BoardNote = {
          id: node.id,
          whiteboardId: boardId,
          text: (node.data as StickyNodeType['data']).text,
          x: node.position.x,
          y: node.position.y,
          ...nodeSize(node),
        }
        void boardItemsRepository.removeNote(node.id).then(() => useBoardNotesStore.getState().load())
        return () => {
          void boardItemsRepository.putNote(note).then(() => useBoardNotesStore.getState().load())
          setNodes((nds) => [...nds, toStickyNode(note)])
        }
      }
      // 卡片實例：連到它的線會一起被清掉，還原時要一起補回來
      const data = node.data as CardNodeType['data']
      const instance: CardInstance = {
        id: node.id,
        whiteboardId: boardId,
        cardId: data.cardId,
        x: node.position.x,
        y: node.position.y,
        width: nodeSize(node).width,
        height: node.height ?? 0,
        color: data.color,
        sectionId: null,
      }
      const lostEdges = edges.filter((e) => e.source === node.id || e.target === node.id)
      void boardItemsRepository.removeInstance(node.id)
      setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id))
      return () => {
        void boardItemsRepository.putInstance(instance)
        setNodes((nds) => [...nds, toCardNode(instance)])
        for (const e of lostEdges) {
          void boardItemsRepository.putEdge({
            id: e.id,
            whiteboardId: boardId,
            fromInstanceId: e.source,
            toInstanceId: e.target,
            label: typeof e.label === 'string' ? e.label : null,
            arrow: 'forward',
          })
        }
        setEdges((eds) => [...eds, ...lostEdges])
      }
    },
    [boardId, edges, setEdges, setNodes, toSectionNode],
  )

  const handleNodesChange = useCallback(
    (changes: NodeChange<BoardNode>[]) => {
      const removed = changes
        .filter((c) => c.type === 'remove')
        .map((c) => nodes.find((n) => n.id === c.id))
        .filter((n): n is BoardNode => !!n)

      if (removed.length > 0) {
        const restores = removed.map(removeNodeWithRestore)
        pushHistory({
          label: removed.length > 1 ? `刪除 ${removed.length} 個項目` : '刪除項目',
          undo: () => restores.forEach((fn) => fn()),
          redo: () => removed.forEach(removeNodeWithRestore),
        })
      }
      onNodesChange(changes)
    },
    [nodes, onNodesChange, pushHistory, removeNodeWithRestore],
  )

  /** 從畫面上的線還原成資料庫的線 */
  const toBoardEdge = useCallback(
    (edge: Edge): BoardEdge => ({
      id: edge.id,
      whiteboardId: boardId,
      fromInstanceId: edge.source,
      toInstanceId: edge.target,
      label: typeof edge.label === 'string' ? edge.label : null,
      arrow: 'forward',
    }),
    [boardId],
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const removed = changes
        .filter((c) => c.type === 'remove')
        .map((c) => edges.find((e) => e.id === c.id))
        .filter((e): e is Edge => !!e)

      for (const edge of removed) void boardItemsRepository.removeEdge(edge.id)

      if (removed.length > 0) {
        const saved = removed.map(toBoardEdge)
        pushHistory({
          label: '刪除連線',
          undo: () => {
            for (const e of saved) void boardItemsRepository.putEdge(e)
            setEdges((eds) => [...eds, ...removed])
          },
          redo: () => {
            for (const e of saved) void boardItemsRepository.removeEdge(e.id)
            setEdges((eds) => eds.filter((e) => !saved.some((r) => r.id === e.id)))
          },
        })
      }
      onEdgesChange(changes)
    },
    [edges, onEdgesChange, pushHistory, setEdges, toBoardEdge],
  )

  const handleNodeDragStart = useCallback(() => {
    dragStartRef.current = snapshot(nodes)
  }, [nodes])

  const handleNodeDragStop = useCallback(
    (_: unknown, __: Node, dragged: Node[]) => {
      const draggedIds = new Set(dragged.map((n) => n.id))
      // #4 拖曳結束後記錄「誰從哪搬到哪」（含被區域帶著跑的卡片）
      const before = dragStartRef.current
      const after: PosSnapshot[] = []
      const track = (node: { id: string; type?: string }, x: number, y: number) => {
        after.push({ id: node.id, type: node.type ?? 'card', x, y })
      }
      for (const node of dragged) track(node, node.position.x, node.position.y)

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
                  track(n, x, y)
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

      const movedIds = new Set(after.map((p) => p.id))
      const from = before.filter(
        (p) => movedIds.has(p.id) && after.some((q) => q.id === p.id && (q.x !== p.x || q.y !== p.y)),
      )
      if (from.length > 0) {
        const to = after.filter((p) => from.some((q) => q.id === p.id))
        pushMove(from.length > 1 ? `移動 ${from.length} 個項目` : '移動項目', from, to)
      }
    },
    [nodes, setNodes, pushMove],
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
      pushHistory({
        label: '新增連線',
        undo: () => {
          void boardItemsRepository.removeEdge(edge.id)
          setEdges((eds) => eds.filter((e) => e.id !== edge.id))
        },
        redo: () => {
          void boardItemsRepository.putEdge(edge)
          setEdges((eds) => [...eds, toFlowEdge(edge)])
        },
      })
    },
    [boardId, pushHistory, setEdges],
  )

  // #6 從卡片的連接點拉出後，放開時只要落在任一張卡片上就連線（不必精準對到端點）
  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      // 已經連到某個端點就交給 onConnect 處理，這裡只補「落在卡片本體」的情況
      if (connectionState.isValid) return
      const fromNode = connectionState.fromNode
      if (!fromNode || fromNode.type !== 'card') return
      const point = 'changedTouches' in event ? event.changedTouches[0] : event
      const dropEl = document.elementFromPoint(point.clientX, point.clientY) as HTMLElement | null
      const targetId = dropEl?.closest('.react-flow__node')?.getAttribute('data-id')
      if (!targetId || targetId === fromNode.id) return
      const targetNode = nodes.find((n) => n.id === targetId)
      if (!targetNode || targetNode.type !== 'card') return
      // 避免重複連線
      const exists = edges.some((e) => e.source === fromNode.id && e.target === targetId)
      if (exists) return
      handleConnect({ source: fromNode.id, target: targetId, sourceHandle: null, targetHandle: null })
    },
    [nodes, edges, handleConnect],
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
      pushHistory({
        label: '把卡片放上白板',
        undo: () => {
          void boardItemsRepository.removeInstance(instance.id)
          setNodes((nds) => nds.filter((n) => n.id !== instance.id))
        },
        redo: () => {
          void boardItemsRepository.putInstance(instance)
          setNodes((nds) => [...nds, toCardNode(instance)])
        },
      })
    },
    [boardId, pushHistory, setNodes],
  )

  const createCardAt = useCallback(
    async (x: number, y: number) => {
      const card = await createCardInStore()
      await addInstance(card.id, x, y)
      // #7 立刻讓卡片庫反映新卡片（不必刷新頁面）
      void useCardStore.getState().load()
      setEditingCardId(card.id)
    },
    [createCardInStore, addInstance],
  )

  // #6 多選後的對齊與等距分佈
  const selectedNodes = nodes.filter((n) => n.selected)

  const alignSelected = useCallback(
    (mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom' | 'hspace' | 'vspace') => {
      const picked = nodes.filter((n) => n.selected)
      if (picked.length < 2) return
      const before = snapshot(picked)
      const boxes = picked.map((n) => ({ node: n, ...nodeSize(n) }))

      let after: PosSnapshot[]
      if (mode === 'hspace' || mode === 'vspace') {
        // 等距分佈：頭尾不動，中間依序平均放
        const horizontal = mode === 'hspace'
        const sorted = [...boxes].sort((a, b) =>
          horizontal ? a.node.position.x - b.node.position.x : a.node.position.y - b.node.position.y,
        )
        const first = sorted[0]
        const last = sorted[sorted.length - 1]
        const start = horizontal ? first.node.position.x : first.node.position.y
        const end = horizontal
          ? last.node.position.x + last.width
          : last.node.position.y + last.height
        const totalSize = sorted.reduce((sum, b) => sum + (horizontal ? b.width : b.height), 0)
        const gap = (end - start - totalSize) / (sorted.length - 1)
        let cursor = start
        after = sorted.map((b) => {
          const pos = {
            id: b.node.id,
            type: b.node.type ?? 'card',
            x: horizontal ? cursor : b.node.position.x,
            y: horizontal ? b.node.position.y : cursor,
          }
          cursor += (horizontal ? b.width : b.height) + gap
          return pos
        })
      } else {
        const left = Math.min(...boxes.map((b) => b.node.position.x))
        const right = Math.max(...boxes.map((b) => b.node.position.x + b.width))
        const top = Math.min(...boxes.map((b) => b.node.position.y))
        const bottom = Math.max(...boxes.map((b) => b.node.position.y + b.height))
        after = boxes.map((b) => {
          let { x, y } = b.node.position
          if (mode === 'left') x = left
          else if (mode === 'right') x = right - b.width
          else if (mode === 'hcenter') x = (left + right) / 2 - b.width / 2
          else if (mode === 'top') y = top
          else if (mode === 'bottom') y = bottom - b.height
          else if (mode === 'vcenter') y = (top + bottom) / 2 - b.height / 2
          return { id: b.node.id, type: b.node.type ?? 'card', x, y }
        })
      }

      applyPositions(after)
      pushMove('對齊項目', before, after)
    },
    [nodes, applyPositions, pushMove],
  )

  // #4 Ctrl/⌘+Z 上一步、Ctrl/⌘+Shift+Z（或 Ctrl+Y）重做
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return
      // 正在打字（卡片編輯器、便利貼、輸入框）時交給編輯器自己的復原
      const el = document.activeElement as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      e.preventDefault()
      const store = useBoardHistoryStore.getState()
      if (key === 'y' || e.shiftKey) void store.redo()
      else void store.undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // #8/#14 點白板空白處：關閉編輯視窗、取消選取，但停留在白板
  const handlePaneClick = useCallback(() => {
    setEditingCardId(null)
  }, [])

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
    void useBoardNotesStore.getState().load()
    pushHistory({
      label: '新增便利貼',
      undo: () => {
        void boardItemsRepository.removeNote(note.id).then(() => useBoardNotesStore.getState().load())
        setNodes((nds) => nds.filter((n) => n.id !== note.id))
      },
      redo: () => {
        void boardItemsRepository.putNote(note).then(() => useBoardNotesStore.getState().load())
        setNodes((nds) => [...nds, toStickyNode(note)])
      },
    })
  }, [boardId, centerPos, pushHistory, setNodes])

  const handleAddSection = useCallback(async () => {
    const pos = centerPos()
    const section = await boardItemsRepository.addSection(boardId, pos.x - 210, pos.y - 150)
    sectionsRef.current.set(section.id, section)
    setNodes((nds) => [toSectionNode(section), ...nds])
    pushHistory({
      label: '新增區域',
      undo: () => {
        sectionsRef.current.delete(section.id)
        void boardItemsRepository.removeSection(section.id)
        setNodes((nds) => nds.filter((n) => n.id !== section.id))
      },
      redo: () => {
        sectionsRef.current.set(section.id, section)
        void boardItemsRepository.putSection(section)
        setNodes((nds) => [toSectionNode(section), ...nds])
      },
    })
  }, [boardId, centerPos, pushHistory, setNodes, toSectionNode])

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
          <span className="card-toolbar-sep" />
          {/* #4 上一步／重做 */}
          <button
            type="button"
            title="上一步（Ctrl/⌘+Z）"
            aria-label="上一步"
            disabled={!canUndo}
            onClick={() => void useBoardHistoryStore.getState().undo()}
            className="rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-35"
          >
            ↶ 上一步
          </button>
          <button
            type="button"
            title="重做（Ctrl/⌘+Shift+Z）"
            aria-label="重做"
            disabled={!canRedo}
            onClick={() => void useBoardHistoryStore.getState().redo()}
            className="rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-35"
          >
            ↷ 重做
          </button>
          {/* #6 框選模式：拖曳直接框選多張卡片（關閉時拖曳是平移畫布） */}
          <button
            type="button"
            title="框選模式：直接拖曳框選多張卡片（關閉時按住 Shift 拖曳也可框選）"
            aria-label="框選模式"
            aria-pressed={selectionMode}
            onClick={() => setSelectionMode((v) => !v)}
            className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
              selectionMode
                ? 'border-blue-400 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            ⬚ 框選
          </button>
          <span className="text-xs text-gray-400">雙擊空白處新增卡片</span>
        </div>

        {/* #6 選到兩個以上項目時出現的對齊工具列 */}
        {selectedNodes.length > 1 && (
          <div className="align-toolbar">
            <span className="align-toolbar-label">已選 {selectedNodes.length} 個</span>
            <button type="button" title="靠左對齊" aria-label="靠左對齊" onClick={() => alignSelected('left')}>⇤</button>
            <button type="button" title="水平置中" aria-label="水平置中" onClick={() => alignSelected('hcenter')}>⇔</button>
            <button type="button" title="靠右對齊" aria-label="靠右對齊" onClick={() => alignSelected('right')}>⇥</button>
            <span className="align-toolbar-sep" />
            <button type="button" title="靠上對齊" aria-label="靠上對齊" onClick={() => alignSelected('top')}>⤒</button>
            <button type="button" title="垂直置中" aria-label="垂直置中" onClick={() => alignSelected('vcenter')}>⇕</button>
            <button type="button" title="靠下對齊" aria-label="靠下對齊" onClick={() => alignSelected('bottom')}>⤓</button>
            <span className="align-toolbar-sep" />
            <button type="button" title="水平等距分佈" aria-label="水平等距分佈" onClick={() => alignSelected('hspace')}>⇹</button>
            <button type="button" title="垂直等距分佈" aria-label="垂直等距分佈" onClick={() => alignSelected('vspace')}>⤡</button>
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
          onConnect={handleConnect}
          onConnectEnd={handleConnectEnd}
          onEdgeDoubleClick={handleEdgeDoubleClick}
          onPaneClick={handlePaneClick}
          onSelectionStart={handleSelectionStart}
          onSelectionEnd={handleSelectionEnd}
          onNodeDoubleClick={(_, node) => {
            if (node.type === 'card') setEditingCardId((node as CardNodeType).data.cardId)
          }}
          // #6 框選模式：左鍵拖曳＝框選，中鍵/右鍵拖曳＝平移畫布
          selectionOnDrag={selectionMode}
          panOnDrag={selectionMode ? [1, 2] : true}
          connectionMode={ConnectionMode.Loose}
          // 放大吸附半徑：放開時只要落在卡片本體，就近吸附到該卡片的連接點（#1 不必對準端點）
          connectionRadius={240}
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
