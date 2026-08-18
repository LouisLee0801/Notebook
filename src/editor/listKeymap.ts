import { Extension } from '@tiptap/core'
import { keymap } from '@tiptap/pm/keymap'
import { liftListItem } from '@tiptap/pm/schema-list'
import type { EditorState, Transaction } from '@tiptap/pm/state'

// 清單項目的 Backspace 行為（#7）
//
// 預設行為：在清單項目最前面按 Backspace 會把文字併進上一個項目
// （「第一項」+「子項目」變成「第一項子項目」），內縮過的項目永遠回不到上一層。
// 這裡改成 Notion/Heptabase 的作法：
//   * 子層項目 → 退回上一層（與上層的編號/圓點對齊）
//   * 最外層項目 → 脫離清單變成一般段落
// 兩者都是 liftListItem，差別只在原本的巢狀深度。
//
// 以 ProseMirror keymap plugin（而非 addKeyboardShortcuts）實作：
// keymap 拿到的是按鍵當下、已同步 DOM 選取的 state，
// 用 editor.state 可能還停在游標移動前的位置而誤判。
const ITEM_TYPES = ['listItem', 'taskItem']

export function liftListItemAtStart(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const { selection } = state
  if (!selection.empty) return false

  const { $from } = selection
  // 游標必須落在文字區塊的最前面
  if ($from.parentOffset !== 0) return false

  // 往上找最近的清單項目
  let itemDepth = -1
  for (let d = $from.depth; d > 0; d -= 1) {
    if (ITEM_TYPES.includes($from.node(d).type.name)) {
      itemDepth = d
      break
    }
  }
  if (itemDepth < 0) return false

  // 游標必須在該項目的開頭（而不是項目內第二段之後）
  for (let d = itemDepth + 1; d <= $from.depth; d += 1) {
    if ($from.index(d - 1) !== 0) return false
  }

  return liftListItem($from.node(itemDepth).type)(state, dispatch)
}

export const ListBackspace = Extension.create({
  name: 'listBackspace',
  // 要先於預設的 Backspace（joinBackward）處理
  priority: 1000,

  addProseMirrorPlugins() {
    return [keymap({ Backspace: liftListItemAtStart })]
  },
})
