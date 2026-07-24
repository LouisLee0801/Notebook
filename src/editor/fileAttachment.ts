import { Node, mergeAttributes } from '@tiptap/core'

// 檔案附件（#7）：非圖片檔以 data URL 存在卡片內容裡（隨卡片同步），
// 渲染成可點擊下載的附件節點。大檔案會膨脹資料庫，故有大小上限提醒。
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024 // 5MB

export interface AttachmentAttrs {
  src: string
  name: string
  size: number
}

function formatSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return ` · ${bytes} B`
  if (bytes < 1024 * 1024) return ` · ${(bytes / 1024).toFixed(0)} KB`
  return ` · ${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export const FileAttachment = Node.create({
  name: 'fileAttachment',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      name: { default: '檔案' },
      size: { default: 0 },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-file-attachment]',
        getAttrs: (el) => {
          const e = el as HTMLElement
          return {
            src: e.getAttribute('href'),
            name: e.getAttribute('download') || e.getAttribute('data-name') || '檔案',
            size: Number(e.getAttribute('data-size')) || 0,
          }
        },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const size = Number(node.attrs.size) || 0
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-file-attachment': '',
        'data-name': node.attrs.name,
        'data-size': String(size),
        href: node.attrs.src,
        download: node.attrs.name,
        class: 'file-attach',
        // 附件在編輯器內不可誤觸下載；點選是為了選取/刪除
        contenteditable: 'false',
      }),
      `📎 ${node.attrs.name}${formatSize(size)}`,
    ]
  },
})
