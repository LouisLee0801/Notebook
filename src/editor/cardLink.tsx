import { Extension, Node, mergeAttributes } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react'
import { useCardStore } from '../store/useCardStore'
import { useWhiteboardStore } from '../store/useWhiteboardStore'
import { cardRepository } from '../db/cardRepository'
import { dropdownRenderer, type DropdownItem } from './suggestionDropdown'

// 雙向連結（features.md 模組 2/4，P0）：
// - CardLinkNode：行內 atom 節點，attrs = { cardId, label }
//   label 是插入當下的標題快照，唯讀渲染（白板節點）用；
//   編輯器內的 NodeView 讀 store 即時標題，卡片改名會跟著更新。
// - CardLinkSuggestion：輸入 `[[` 搜尋卡片並插入；查無卡片可直接建立。

function CardLinkChip({ node }: NodeViewProps) {
  const cardId = node.attrs.cardId as string
  const liveTitle = useCardStore((s) => s.cards.find((c) => c.id === cardId)?.title)
  const title = liveTitle ?? (node.attrs.label as string) ?? ''

  return (
    <NodeViewWrapper
      as="span"
      className="card-link"
      onClick={() => {
        useCardStore.getState().select(cardId)
        useWhiteboardStore.getState().openLibrary()
      }}
    >
      {title || '未命名卡片'}
    </NodeViewWrapper>
  )
}

export const CardLinkNode = Node.create({
  name: 'cardLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      cardId: { default: null },
      label: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-card-link]',
        getAttrs: (el) => ({
          cardId: (el as HTMLElement).getAttribute('data-card-link'),
          label: (el as HTMLElement).textContent,
        }),
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-card-link': node.attrs.cardId,
        class: 'card-link',
      }),
      String(node.attrs.label || '未命名卡片'),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CardLinkChip)
  },
})

interface CardLinkItem extends DropdownItem {
  cardId?: string
  createTitle?: string
}

export const CardLinkSuggestion = Extension.create({
  name: 'cardLinkSuggestion',

  addProseMirrorPlugins() {
    return [
      Suggestion<CardLinkItem>({
        editor: this.editor,
        pluginKey: new PluginKey('cardLinkSuggestion'),
        char: '[[',
        allowSpaces: true,
        command: ({ editor, range, props }) => {
          const insert = (cardId: string, label: string) =>
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent([
                { type: 'cardLink', attrs: { cardId, label } },
                { type: 'text', text: ' ' },
              ])
              .run()

          if (props.cardId) {
            insert(props.cardId, props.title)
            return
          }
          // 連到不存在的卡片：先建立再插入（features.md P0）
          const title = props.createTitle ?? ''
          void (async () => {
            const card = await cardRepository.create()
            await cardRepository.update(card.id, { title })
            await useCardStore.getState().load()
            insert(card.id, title)
          })()
        },
        items: ({ query }) => {
          const q = query.trim().toLowerCase()
          const cards = useCardStore.getState().cards
          const matches: CardLinkItem[] = cards
            .filter((c) => c.title.toLowerCase().includes(q))
            .slice(0, 8)
            .map((c) => ({ title: c.title || '未命名卡片', cardId: c.id }))
          if (q && !cards.some((c) => c.title.toLowerCase() === q)) {
            matches.push({ title: query.trim(), subtitle: '建立新卡片', createTitle: query.trim() })
          }
          return matches
        },
        render: dropdownRenderer<CardLinkItem>('輸入以搜尋卡片'),
      }),
    ]
  },
})
