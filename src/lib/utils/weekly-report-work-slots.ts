import type { Json } from '@/types/database'

export type WeekHalf = 'am' | 'pm'

/** 与 `WeekHalfDayPicker` 一致：单日上/下午槽位 */
export type WeekHalfSlot = {
  isoDate: string
  half: WeekHalf
}

export function weekHalfSlotToKey(s: WeekHalfSlot): string {
  return `${s.isoDate}-${s.half}`
}

export function parseWeekHalfSlotKey(key: string): WeekHalfSlot | null {
  const m = /^(\d{4}-\d{2}-\d{2})-(am|pm)$/.exec(key.trim())
  if (!m) return null
  return { isoDate: m[1], half: m[2] as WeekHalf }
}

function sortSlotsUnique(slots: Iterable<WeekHalfSlot>): WeekHalfSlot[] {
  const seen = new Set<string>()
  const out: WeekHalfSlot[] = []
  for (const s of slots) {
    const k = weekHalfSlotToKey(s)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(s)
  }
  return out.sort((a, b) => {
    if (a.isoDate !== b.isoDate) return a.isoDate.localeCompare(b.isoDate)
    return a.half === 'am' ? (b.half === 'am' ? 0 : -1) : 1
  })
}

/** 从 DB `work_dates` JSON 解析为半天列表 */
export function parseWorkDatesJson(value: Json | null | undefined): WeekHalfSlot[] {
  if (value == null || !Array.isArray(value)) return []
  const out: WeekHalfSlot[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const isoDate = typeof o.isoDate === 'string' ? o.isoDate.trim() : ''
    const half = o.half === 'am' || o.half === 'pm' ? o.half : null
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || !half) continue
    out.push({ isoDate, half })
  }
  return sortSlotsUnique(out)
}

export function workSlotsToJson(slots: readonly WeekHalfSlot[]): Json {
  return sortSlotsUnique(slots) as unknown as Json
}

export function weekHalfSlotsToWorkDays(slots: readonly WeekHalfSlot[]): number {
  return slots.length * 0.5
}

export function isSlotInClosedRange(
  slot: WeekHalfSlot,
  rangeStartIso: string,
  rangeEndIso: string
): boolean {
  return slot.isoDate >= rangeStartIso && slot.isoDate <= rangeEndIso
}

export function everySlotInRange(
  slots: readonly WeekHalfSlot[],
  rangeStartIso: string,
  rangeEndIso: string
): boolean {
  return slots.every((s) => isSlotInClosedRange(s, rangeStartIso, rangeEndIso))
}

/** 与已有事项合并后是否出现重复半天（同一 item_type 池内） */
export function hasDuplicateHalfWith(
  slots: readonly WeekHalfSlot[],
  otherKeys: ReadonlySet<string>
): boolean {
  for (const s of slots) {
    if (otherKeys.has(weekHalfSlotToKey(s))) return true
  }
  return false
}

export function slotKeysSet(slots: readonly WeekHalfSlot[]): Set<string> {
  return new Set(slots.map(weekHalfSlotToKey))
}

/** 合并多组半天，按键去重（用于合并「本页其他行」与「其他项目周报」禁用集） */
export function mergeWeekHalfSlotsUnique(
  ...lists: readonly (readonly WeekHalfSlot[])[]
): WeekHalfSlot[] {
  const seen = new Set<string>()
  const out: WeekHalfSlot[] = []
  for (const list of lists) {
    for (const s of list) {
      const k = weekHalfSlotToKey(s)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(s)
    }
  }
  return out
}

/** 考勤/列表展示用简短文案 */
export function formatWorkSlotsBriefZh(slots: readonly WeekHalfSlot[]): string {
  if (!slots.length) return '—'
  const sorted = sortSlotsUnique(slots)
  const parts = sorted.map((s) => {
    const md = `${s.isoDate.slice(5, 7)}/${s.isoDate.slice(8, 10)}`
    const h = s.half === 'am' ? '上午' : '下午'
    return `${md} ${h}`
  })
  return parts.join('、')
}
