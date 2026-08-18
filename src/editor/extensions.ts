import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import type { AnyExtension } from '@tiptap/core'
import { CardLinkNode } from './cardLink'
import { ResizableImage } from './resizableImage'
import { FileAttachment, MAX_ATTACHMENT_BYTES, type AttachmentAttrs } from './fileAttachment'
import { ListBackspace } from './listKeymap'
import { TrailingNode } from './trailingNode'
import { TableEscape } from './tableEscape'

// 編輯器與唯讀渲染（白板卡片節點）共用的 schema，
// 兩邊不一致會導致 generateHTML 解析失敗，務必同步維護。
export const baseExtensions: AnyExtension[] = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Underline,
  Highlight.configure({ multicolor: true }), // 支援多色螢光標記
  TextStyle, // 文字顏色的載體
  Color, // 文字顏色
  // #5 連結：編輯器內單純點擊只是移動游標（才能編輯文字），
  // 要開網頁用 Ctrl/⌘＋點擊、或右鍵選單／連結浮窗的「開啟」。
  Link.configure({
    openOnClick: false,
    autolink: true,
    linkOnPaste: true,
    HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  ResizableImage.configure({ allowBase64: true }), // 圖片以 data URL 存本地；可拖曳縮放（#6）
  Table,
  TableRow,
  TableHeader,
  TableCell,
  CardLinkNode,
  FileAttachment,
  ListBackspace, // #7 清單項目 Backspace 退回上一層
  TrailingNode, // #8 表格等整塊節點後面永遠留一個可打字的空段落
  TableEscape, // #8 最後一列按 ↓ 或 Ctrl/⌘+Enter 離開表格繼續打字
]

/** 讀取任意檔案為附件屬性（data URL）；超過上限回傳 null */
export async function fileToAttachment(file: File): Promise<AttachmentAttrs | null> {
  if (file.size > MAX_ATTACHMENT_BYTES) return null
  const src = await fileToDataUrl(file)
  return { src, name: file.name, size: file.size }
}

/** 讀取圖片檔為 data URL（貼上/拖曳/挑選共用） */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('讀取圖片失敗'))
    reader.readAsDataURL(file)
  })
}
