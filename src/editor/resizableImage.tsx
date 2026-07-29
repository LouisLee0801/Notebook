import { useRef } from 'react'
import Image from '@tiptap/extension-image'
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react'

// 可縮放圖片（#6）：貼入的圖片可拖右下角把手自行拉大縮小。
// 寬度存在 node 的 width 屬性（renderHTML 輸出 <img width=…>），唯讀渲染（白板卡片）也套用。
function ImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const width = node.attrs.width as number | null
  const height = node.attrs.height as number | null
  const imgRef = useRef<HTMLImageElement>(null)

  // axis: 'x' 只調寬、'y' 只調高、'xy' 兩者一起（右下角）
  const startResize = (e: React.PointerEvent, axis: 'x' | 'y' | 'xy') => {
    e.preventDefault()
    e.stopPropagation()
    const img = imgRef.current
    if (!img) return
    const startX = e.clientX
    const startY = e.clientY
    const startW = img.offsetWidth
    const startH = img.offsetHeight
    let finalW = startW
    let finalH = startH
    const onMove = (ev: PointerEvent) => {
      if (axis !== 'y') {
        finalW = Math.max(40, startW + (ev.clientX - startX))
        img.style.width = `${finalW}px`
      }
      if (axis !== 'x') {
        finalH = Math.max(30, startH + (ev.clientY - startY))
        img.style.height = `${finalH}px`
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const patch: Record<string, number> = {}
      if (axis !== 'y') patch.width = Math.round(finalW)
      if (axis !== 'x') patch.height = Math.round(finalH)
      updateAttributes(patch)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <NodeViewWrapper className="resizable-image" data-selected={selected ? 'true' : undefined}>
      <img
        ref={imgRef}
        src={node.attrs.src as string}
        alt={(node.attrs.alt as string) ?? ''}
        style={{
          width: width ? `${width}px` : undefined,
          height: height ? `${height}px` : undefined,
        }}
        draggable={false}
      />
      {selected && (
        <>
          {/* 右側：拉寬/拉窄；下側：拉長/縮短；右下角：兩者一起（#6） */}
          <span className="resizable-image-handle is-e nodrag" onPointerDown={(e) => startResize(e, 'x')} aria-label="調整圖片寬度" />
          <span className="resizable-image-handle is-s nodrag" onPointerDown={(e) => startResize(e, 'y')} aria-label="調整圖片高度" />
          <span className="resizable-image-handle is-se nodrag" onPointerDown={(e) => startResize(e, 'xy')} aria-label="調整圖片大小" />
        </>
      )}
    </NodeViewWrapper>
  )
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = el.getAttribute('width')
          return w ? parseInt(w, 10) : null
        },
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
      height: {
        default: null,
        parseHTML: (el) => {
          const h = el.getAttribute('height')
          return h ? parseInt(h, 10) : null
        },
        renderHTML: (attrs) => (attrs.height ? { height: attrs.height } : {}),
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
})
