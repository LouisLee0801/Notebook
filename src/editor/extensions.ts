import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import type { AnyExtension } from '@tiptap/core'
import { CardLinkNode } from './cardLink'

// 編輯器與唯讀渲染（白板卡片節點）共用的 schema，
// 兩邊不一致會導致 generateHTML 解析失敗，務必同步維護。
export const baseExtensions: AnyExtension[] = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Underline,
  Highlight,
  Link.configure({ openOnClick: false }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Image.configure({ allowBase64: true }), // 圖片先以 data URL 存本地，接 Supabase 後改 Storage
  Table,
  TableRow,
  TableHeader,
  TableCell,
  CardLinkNode,
]

/** 讀取圖片檔為 data URL（貼上/拖曳/挑選共用） */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('讀取圖片失敗'))
    reader.readAsDataURL(file)
  })
}
