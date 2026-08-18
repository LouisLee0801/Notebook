import { Extension } from '@tiptap/core'
import { keymap } from '@tiptap/pm/keymap'
import { TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'

// 從表格「走出來」的按鍵（#8）
//
// 表格是 isolating 節點，游標進去之後方向鍵與 Enter 都只會在儲存格之間打轉，
// 沒辦法接著在表格下方繼續打字。搭配 trailingNode（表格後一定有空段落），
// 這裡讓最後一列按 ↓、或表格內任意處按 Ctrl/⌘+Enter，游標跳到表格後面。

/** 找出游標所在表格的 depth；不在表格內回傳 -1 */
function tableDepthOf(state: EditorState): number {
  const { $from } = state.selection
  for (let d = $from.depth; d > 0; d -= 1) {
    if ($from.node(d).type.name === 'table') return d
  }
  return -1
}

/** 把游標移到表格後面的區塊 */
function moveAfterTable(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  tableDepth: number,
): boolean {
  const after = state.selection.$from.after(tableDepth)
  if (after > state.doc.content.size) return false
  const selection = TextSelection.near(state.doc.resolve(after), 1)
  if (dispatch) dispatch(state.tr.setSelection(selection).scrollIntoView())
  return true
}

/** ↓：游標在最後一列的最後一個段落時，離開表格 */
export function exitTableDown(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const tableDepth = tableDepthOf(state)
  if (tableDepth < 0) return false

  const { $from } = state.selection
  const table = $from.node(tableDepth)
  // 不是最後一列 → 讓預設行為往下一列移動
  if ($from.index(tableDepth) !== table.childCount - 1) return false
  // 儲存格內還有下一個區塊 → 先在儲存格內移動
  const cellDepth = tableDepth + 2 // table > row > cell
  if ($from.depth > cellDepth && $from.index(cellDepth) !== $from.node(cellDepth).childCount - 1) {
    return false
  }

  return moveAfterTable(state, dispatch, tableDepth)
}

/** Ctrl/⌘+Enter：表格內任意處直接跳到表格後面 */
export function exitTableEnter(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const tableDepth = tableDepthOf(state)
  if (tableDepth < 0) return false
  return moveAfterTable(state, dispatch, tableDepth)
}

export const TableEscape = Extension.create({
  name: 'tableEscape',
  // 要先於 prosemirror-tables 自己的方向鍵處理
  priority: 1000,

  addProseMirrorPlugins() {
    return [
      keymap({
        ArrowDown: exitTableDown,
        'Mod-Enter': exitTableEnter,
      }),
    ]
  },
})
