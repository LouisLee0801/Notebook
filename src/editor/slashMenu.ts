import { Extension, type Editor, type Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'
import { dropdownRenderer, type DropdownItem } from './suggestionDropdown'

// `/` 指令選單（features.md 模組 2，P0）

interface SlashCommand extends DropdownItem {
  keywords: string
  run: (editor: Editor, range: Range) => void
}

const COMMANDS: SlashCommand[] = [
  {
    title: '段落',
    keywords: 'paragraph text 段落 文字 p',
    run: (editor, range) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: '標題 1',
    keywords: 'heading h1 標題',
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
  },
  {
    title: '標題 2',
    keywords: 'heading h2 標題',
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
  },
  {
    title: '標題 3',
    keywords: 'heading h3 標題',
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
  },
  {
    title: '無序清單',
    keywords: 'bullet list ul 清單 列表',
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: '有序清單',
    keywords: 'ordered numbered list ol 編號 清單',
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: '待辦清單',
    keywords: 'todo task checkbox 待辦 勾選',
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: '引言',
    keywords: 'quote blockquote 引言 引用',
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: '程式碼區塊',
    keywords: 'code codeblock 程式 代碼',
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: '分隔線',
    keywords: 'divider hr horizontal rule 分隔',
    run: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: '表格',
    keywords: 'table 表格',
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    title: '圖片',
    keywords: 'image picture photo 圖片 相片',
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).run()
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) return
        void import('./extensions').then(({ fileToDataUrl }) =>
          fileToDataUrl(file).then((src) => editor.chain().focus().setImage({ src }).run()),
        )
      }
      input.click()
    },
  },
]

export const SlashMenu = Extension.create({
  name: 'slashMenu',

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommand>({
        editor: this.editor,
        pluginKey: new PluginKey('slashMenu'),
        char: '/',
        command: ({ editor, range, props }) => props.run(editor, range),
        items: ({ query }) => {
          const q = query.toLowerCase()
          return COMMANDS.filter(
            (c) => c.title.toLowerCase().includes(q) || c.keywords.toLowerCase().includes(q),
          )
        },
        render: dropdownRenderer<SlashCommand>('沒有符合的區塊'),
      }),
    ]
  },
})
