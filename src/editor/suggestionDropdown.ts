import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'

// slash 選單與 [[卡片連結]] 共用的浮動下拉選單（純 DOM，跟編輯器解耦）。

export interface DropdownItem {
  title: string
  subtitle?: string
}

class DropdownView<T extends DropdownItem> {
  private el: HTMLDivElement
  private selectedIndex = 0
  private props: SuggestionProps<T>
  private emptyText: string

  constructor(props: SuggestionProps<T>, emptyText: string) {
    this.props = props
    this.emptyText = emptyText
    this.el = document.createElement('div')
    this.el.className = 'slash-menu'
    document.body.appendChild(this.el)
    this.render()
  }

  update(props: SuggestionProps<T>) {
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
      empty.textContent = this.emptyText
      this.el.appendChild(empty)
      return
    }
    this.props.items.forEach((item, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'slash-menu-item' + (index === this.selectedIndex ? ' is-selected' : '')
      const title = document.createElement('span')
      title.textContent = item.title
      button.appendChild(title)
      if (item.subtitle) {
        const subtitle = document.createElement('span')
        subtitle.className = 'slash-menu-subtitle'
        subtitle.textContent = item.subtitle
        button.appendChild(subtitle)
      }
      button.addEventListener('mousedown', (e) => {
        e.preventDefault()
        this.props.command(item)
      })
      this.el.appendChild(button)
    })
    // 鍵盤上下移動時，讓被選取的項目捲進可視範圍
    this.el.querySelector('.slash-menu-item.is-selected')?.scrollIntoView({ block: 'nearest' })
  }
}

/** 提供給 @tiptap/suggestion 的 render() 實作 */
export function dropdownRenderer<T extends DropdownItem>(emptyText: string) {
  return () => {
    let view: DropdownView<T> | null = null
    return {
      onStart: (props: SuggestionProps<T>) => {
        view = new DropdownView(props, emptyText)
      },
      onUpdate: (props: SuggestionProps<T>) => view?.update(props),
      onKeyDown: (props: SuggestionKeyDownProps) => {
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
  }
}
