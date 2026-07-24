// TipTap JSON → Markdown（features.md 模組 9，P0：單卡與整庫匯出）

interface Mark {
  type: string
  attrs?: Record<string, unknown>
}

interface ContentNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: Mark[]
  content?: ContentNode[]
}

function renderInline(nodes: ContentNode[] | undefined): string {
  if (!nodes) return ''
  return nodes
    .map((node) => {
      if (node.type === 'cardLink') return `[[${String(node.attrs?.label ?? '')}]]`
      if (node.type !== 'text') return ''
      let text = node.text ?? ''
      for (const mark of node.marks ?? []) {
        switch (mark.type) {
          case 'bold':
            text = `**${text}**`
            break
          case 'italic':
            text = `*${text}*`
            break
          case 'strike':
            text = `~~${text}~~`
            break
          case 'code':
            text = `\`${text}\``
            break
          case 'highlight':
            text = `==${text}==`
            break
          case 'underline':
            text = `<u>${text}</u>`
            break
          case 'link':
            text = `[${text}](${String(mark.attrs?.href ?? '')})`
            break
        }
      }
      return text
    })
    .join('')
}

// 每個 block 轉成一個（可能多行的）字串，block 之間以空行分隔
function renderBlock(node: ContentNode): string {
  switch (node.type) {
    case 'paragraph':
      return renderInline(node.content)
    case 'heading':
      return '#'.repeat(Number(node.attrs?.level ?? 1)) + ' ' + renderInline(node.content)
    case 'bulletList':
      return (node.content ?? []).map((item) => renderListItem(item, '- ')).join('\n')
    case 'orderedList': {
      let i = Number(node.attrs?.start ?? 1)
      return (node.content ?? [])
        .map((item) => renderListItem(item, `${i++}. `))
        .join('\n')
    }
    case 'taskList':
      return (node.content ?? [])
        .map((item) => renderListItem(item, item.attrs?.checked ? '- [x] ' : '- [ ] '))
        .join('\n')
    case 'blockquote':
      return renderBlocks(node.content)
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n')
    case 'codeBlock': {
      const lang = String(node.attrs?.language ?? '')
      const code = (node.content ?? []).map((t) => t.text ?? '').join('')
      return '```' + lang + '\n' + code + '\n```'
    }
    case 'horizontalRule':
      return '---'
    case 'image':
      return `![圖片](${String(node.attrs?.src ?? '')})`
    case 'fileAttachment':
      return `[📎 ${String(node.attrs?.name ?? '檔案')}](${String(node.attrs?.src ?? '')})`
    case 'table': {
      const rows = node.content ?? []
      const lines: string[] = []
      rows.forEach((row, rowIndex) => {
        const cells = (row.content ?? []).map((cell) =>
          renderBlocks(cell.content).replace(/\n+/g, ' ').trim(),
        )
        lines.push(`| ${cells.join(' | ')} |`)
        if (rowIndex === 0) lines.push(`| ${cells.map(() => '---').join(' | ')} |`)
      })
      return lines.join('\n')
    }
    default:
      return node.content ? renderBlocks(node.content) : ''
  }
}

function renderBlocks(nodes: ContentNode[] | undefined): string {
  return (nodes ?? []).map(renderBlock).filter((b) => b !== '').join('\n\n')
}

function renderListItem(item: ContentNode, prefix: string): string {
  const inner = renderBlocks(item.content).split('\n\n').join('\n')
  if (!inner) return prefix.trimEnd()
  const [first, ...rest] = inner.split('\n')
  return [prefix + first, ...rest.map((l) => '  ' + l)].join('\n')
}

export function jsonToMarkdown(content: unknown): string {
  const doc = content as ContentNode
  return renderBlocks(doc?.content).trim()
}

export function cardToMarkdown(card: { title: string; content: unknown }): string {
  const body = jsonToMarkdown(card.content)
  return `# ${card.title || '未命名卡片'}\n\n${body}\n`
}

export function downloadMarkdown(filename: string, markdown: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
