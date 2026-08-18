import { describe, expect, it } from 'vitest'
import { normalizeUrl } from './linkUrl'

describe('normalizeUrl（#5 超連結）', () => {
  it('保留已有通訊協定的網址', () => {
    expect(normalizeUrl('https://example.com/a')).toBe('https://example.com/a')
    expect(normalizeUrl('http://example.com')).toBe('http://example.com')
    expect(normalizeUrl('mailto:a@b.com')).toBe('mailto:a@b.com')
  })

  it('沒有通訊協定時補上 https', () => {
    expect(normalizeUrl('example.com/hvdc')).toBe('https://example.com/hvdc')
    expect(normalizeUrl('  www.example.com  ')).toBe('https://www.example.com')
  })

  it('email 轉成 mailto', () => {
    expect(normalizeUrl('someone@example.com')).toBe('mailto:someone@example.com')
  })

  it('空字串代表移除連結', () => {
    expect(normalizeUrl('   ')).toBe('')
  })
})
