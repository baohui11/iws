/** 过去时间相对展示（中文） */
export function formatRelativeTimePast(iso: string): string {
  const d = new Date(iso)
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diffSec < 45) return '刚刚'

  const rtf = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' })
  const minutes = Math.floor(diffSec / 60)
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 7) return rtf.format(-days, 'day')
  return d.toLocaleDateString('zh-CN')
}
