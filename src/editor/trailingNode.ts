import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

// 文件結尾一定留一個空段落（#8）
//
// 表格、圖片、附件、程式碼區塊等「整塊型」節點若剛好是文件最後一個節點，
// 後面就沒有任何可放游標的位置，使用者按 Enter/往下都只會回到節點內部，
// 沒辦法接著往下打字。這裡在這種情況自動補一個空段落當出口。

// 會把游標困住的節點；最後一個是這些就要補段落
const TRAPPING_NODES = new Set([
  'table',
  'image',
  'fileAttachment',
  'codeBlock',
  'horizontalRule',
  'blockquote',
])

function needsTrailing(doc: { lastChild: { type: { name: string } } | null }): boolean {
  const last = doc.lastChild
  return !!last && TRAPPING_NODES.has(last.type.name)
}

export const TrailingNode = Extension.create({
  name: 'trailingNode',

  // 開檔時若結尾就是整塊型節點，直接補上（舊卡片也能修好）
  onCreate() {
    const { state, view } = this.editor
    // generateHTML 等無畫面的用法沒有 view，直接略過
    if (!view || !needsTrailing(state.doc)) return
    const paragraph = state.schema.nodes.paragraph
    if (!paragraph) return
    view.dispatch(state.tr.insert(state.doc.content.size, paragraph.create()))
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('trailingNode'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null
          if (!needsTrailing(newState.doc)) return null
          const paragraph = newState.schema.nodes.paragraph
          if (!paragraph) return null
          return newState.tr.insert(newState.doc.content.size, paragraph.create())
        },
      }),
    ]
  },
})
