import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
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
  CardLinkNode,
]
