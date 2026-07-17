import { describe, expect, it } from 'vitest'
import { jsonToMarkdown } from './markdown'
import { extractText, searchCards } from './text'

const doc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '標題' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '粗體', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' 與 ' },
        { type: 'cardLink', attrs: { cardId: 'x', label: '另一張卡' } },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '項目一' }] }],
        },
      ],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '完成的事' }] }],
        },
      ],
    },
    { type: 'horizontalRule' },
    {
      type: 'codeBlock',
      attrs: { language: 'ts' },
      content: [{ type: 'text', text: 'const a = 1' }],
    },
  ],
}

describe('jsonToMarkdown', () => {
  it('renders blocks, marks, links, lists, tasks and code', () => {
    const md = jsonToMarkdown(doc)
    expect(md).toContain('## 標題')
    expect(md).toContain('**粗體** 與 [[另一張卡]]')
    expect(md).toContain('- 項目一')
    expect(md).toContain('- [x] 完成的事')
    expect(md).toContain('---')
    expect(md).toContain('```ts\nconst a = 1\n```')
  })
})

describe('extractText / searchCards', () => {
  it('extracts plain text including card link labels', () => {
    const text = extractText(doc)
    expect(text).toContain('標題')
    expect(text).toContain('粗體 與 另一張卡')
  })

  it('searches title and content with snippet', () => {
    const cards = [
      { id: '1', title: '會議記錄', content: doc },
      { id: '2', title: '其他', content: { type: 'doc', content: [] } },
    ]
    expect(searchCards(cards, '會議')[0].id).toBe('1')
    const byContent = searchCards(cards, '項目一')
    expect(byContent).toHaveLength(1)
    expect(byContent[0].snippet).toContain('項目一')
    expect(searchCards(cards, '')).toHaveLength(0)
  })
})
