/**
 * 浏览器端生成唯一 id（列表 key、临时项等）。
 * `crypto.randomUUID()` 仅在「安全上下文」可用（HTTPS、localhost、127.0.0.1）；
 * 通过 `http://局域网IP` 访问时可能不存在，需降级。
 */
export function randomClientId(): string {
  const c =
    typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint8Array(16)
    c.getRandomValues(buf)
    buf[6] = (buf[6] & 0x0f) | 0x40
    buf[8] = (buf[8] & 0x3f) | 0x80
    const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join(
      ''
    )
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`
}
