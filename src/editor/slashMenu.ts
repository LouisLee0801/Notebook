import { Extension, type Editor, type Range } from '@tiptap/core'
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion'

// `/` 指令選單（features.md 模組 2，P0）。
// 用 @tiptap/suggestion 實作：輸入 / 之後過濾指令、鍵盤上下選擇、Enter 執行。

export interface SlashCommand {
  title: string
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
]

class SlashMenuView {
  private el: HTMLDivElement
  private selectedIndex = 0
  private props: SuggestionProps<SlashCommand>

  constructor(props: SuggestionProps<SlashCommand>) {
    this.props = props
    this.el = document.createElement('div')
    this.el.className = 'slash-menu'
    document.body.appendChild(this.el)
    this.render()
  }

  update(props: SuggestionProps<SlashCommand>) {
    this.props = props
    if (this.selectedIndex >= props.items.length) this.selectedIndex = 0
    this.render()
  }

  onKeyDown({ event }: SuggestionKeyDownProps): boolean {
    const { items } = this.props
    if (items.length === 0) return false
    if (event.key === 'ArrowDown') {
      this.selectedIndex = (this.selectedIndex + 1) % items.length
      this.render()
      return true
    }
    if (event.key === 'ArrowUp') {
      this.selectedIndex = (this.selectedIndex - 1 + items.length) % items.length
      this.render()
      return true
    }
    if (event.key === 'Enter') {
      this.props.command(items[this.selectedIndex])
      return true
    }
    return false
  }

  destroy() {
    this.el.remove()
  }

  private render() {
    const rect = this.props.clientRect?.()
    if (rect) {
      this.el.style.left = `${rect.left + window.scrollX}px`
      this.el.style.top = `${rect.bottom + window.scrollY + 4}px`
    }
    this.el.innerHTML = ''
    if (this.props.items.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'slash-menu-empty'
      empty.textContent = '沒有符合的區塊'
      this.el.appendChild(empty)
      return
    }
    this.props.items.forEach((item, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'slash-menu-item' + (index === this.selectedIndex ? ' is-selected' : '')
      button.textContent = item.title
      button.addEventListener('mousedown', (e) => {
        e.preventDefault()
        this.props.command(item)
      })
      this.el.appendChild(button)
    })
  }
}

export const SlashMenu = Extension.create({
  name: 'slashMenu',

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommand>({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }) => props.run(editor, range),
        items: ({ query }) => {
          const q = query.toLowerCase()
          return COMMANDS.filter(
            (c) => c.title.toLowerCase().includes(q) || c.keywords.toLowerCase().includes(q),
          )
        },
        render: () => {
          let view: SlashMenuView | null = null
          return {
            onStart: (props) => {
              view = new SlashMenuView(props)
            },
            onUpdate: (props) => view?.update(props),
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                view?.destroy()
                view = null
                return true
              }
              return view?.onKeyDown(props) ?? false
            },
            onExit: () => {
              view?.destroy()
              view = null
            },
          }
        },
      }),
    ]
  },
})
