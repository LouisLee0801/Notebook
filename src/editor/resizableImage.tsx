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
  const imgRef = useRef<HTMLImageElement>(null)

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const img = imgRef.current
    if (!img) return
    const startX = e.clientX
    const startW = img.offsetWidth
    let finalW = startW
    const onMove = (ev: PointerEvent) => {
      finalW = Math.max(40, startW + (ev.clientX - startX))
      img.style.width = `${finalW}px`
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      updateAttributes({ width: Math.round(finalW) })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <NodeViewWrapper
      className="resizable-image"
      data-selected={selected ? 'true' : undefined}
    >
      <img
        ref={imgRef}
        src={node.attrs.src as string}
        alt={(node.attrs.alt as string) ?? ''}
        style={width ? { width: `${width}px` } : undefined}
        draggable={false}
      />
      {selected && (
        <span
          className="resizable-image-handle nodrag"
          onPointerDown={startResize}
          aria-label="拖曳調整圖片大小"
        />
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
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
})
