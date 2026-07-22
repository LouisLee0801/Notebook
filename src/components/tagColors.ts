// 標籤色票（#2）：存 key，UI 依 key 取樣式。null = 預設灰綠。
export interface TagColor {
  key: string | null
  label: string
  dot: string // 圓點顏色
  chipBg: string
  chipText: string
}

export const TAG_COLORS: TagColor[] = [
  { key: null, label: '預設', dot: '#10b981', chipBg: '#ecfdf5', chipText: '#047857' },
  { key: 'gray', label: '灰', dot: '#6b7280', chipBg: '#f3f4f6', chipText: '#374151' },
  { key: 'red', label: '紅', dot: '#ef4444', chipBg: '#fef2f2', chipText: '#b91c1c' },
  { key: 'amber', label: '橙', dot: '#f59e0b', chipBg: '#fffbeb', chipText: '#b45309' },
  { key: 'green', label: '綠', dot: '#22c55e', chipBg: '#f0fdf4', chipText: '#15803d' },
  { key: 'blue', label: '藍', dot: '#3b82f6', chipBg: '#eff6ff', chipText: '#1d4ed8' },
  { key: 'purple', label: '紫', dot: '#8b5cf6', chipBg: '#faf5ff', chipText: '#6d28d9' },
  { key: 'pink', label: '粉', dot: '#ec4899', chipBg: '#fdf2f8', chipText: '#be185d' },
]

export function tagColor(key: string | null | undefined): TagColor {
  return TAG_COLORS.find((c) => c.key === (key ?? null)) ?? TAG_COLORS[0]
}
