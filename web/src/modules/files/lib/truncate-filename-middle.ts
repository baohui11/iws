/** 过长文件名中间省略，完整名称请配合 title 属性使用 */
export function truncateFilenameMiddle(
  name: string,
  maxLen = 36
): string {
  if (name.length <= maxLen) return name
  const ellipsis = '…'
  const usable = maxLen - ellipsis.length
  if (usable <= 1) return `${name.slice(0, 1)}${ellipsis}`
  const left = Math.ceil(usable / 2)
  const right = Math.floor(usable / 2)
  return `${name.slice(0, left)}${ellipsis}${name.slice(-right)}`
}
