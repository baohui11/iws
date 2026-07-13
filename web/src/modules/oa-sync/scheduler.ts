import { runLoggedOaSyncAll } from '@/modules/oa-sync/services/sync-runner'

const DEFAULT_CRON = '0 4,13 * * *'
const GLOBAL_KEY = Symbol.for('iws.oaSyncSchedulerStarted')

function isEnabled(): boolean {
  const raw = process.env.OA_SYNC_SCHEDULE_ENABLED?.trim().toLowerCase()
  if (raw == null || raw === '') return true
  return ['1', 'true', 'yes', 'on'].includes(raw)
}

function parseHours(value: string): number[] {
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23)
}

function parseDailyCron(cron: string): { minute: number; hours: number[] } {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5 || parts[2] !== '*' || parts[3] !== '*' || parts[4] !== '*') {
    throw new Error('OA_SYNC_SCHEDULE_CRON 仅支持每天固定小时执行，例如 0 4,13 * * *')
  }

  const minute = Number(parts[0])
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error('OA_SYNC_SCHEDULE_CRON 的分钟必须是 0-59')
  }

  const hours = parseHours(parts[1])
  if (hours.length === 0) {
    throw new Error('OA_SYNC_SCHEDULE_CRON 的小时配置无效')
  }

  return { minute, hours: [...new Set(hours)].sort((a, b) => a - b) }
}

function nextRunAt(from: Date, schedule: { minute: number; hours: number[] }): Date {
  for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
    for (const hour of schedule.hours) {
      const candidate = new Date(from)
      candidate.setDate(from.getDate() + dayOffset)
      candidate.setHours(hour, schedule.minute, 0, 0)
      if (candidate.getTime() > from.getTime()) return candidate
    }
  }

  const fallback = new Date(from)
  fallback.setDate(from.getDate() + 1)
  fallback.setHours(schedule.hours[0], schedule.minute, 0, 0)
  return fallback
}

export function startOaSyncScheduler(): void {
  const globalState = globalThis as typeof globalThis & Record<symbol, boolean>
  if (globalState[GLOBAL_KEY]) return
  globalState[GLOBAL_KEY] = true

  if (!isEnabled()) {
    console.log('[oa-sync-scheduler] disabled')
    return
  }

  const cron = process.env.OA_SYNC_SCHEDULE_CRON?.trim() || DEFAULT_CRON
  const schedule = parseDailyCron(cron)

  const planNext = () => {
    const runAt = nextRunAt(new Date(), schedule)
    const delayMs = Math.max(1_000, runAt.getTime() - Date.now())
    console.log(`[oa-sync-scheduler] next run at ${runAt.toISOString()}`)

    setTimeout(async () => {
      try {
        console.log('[oa-sync-scheduler] started')
        await runLoggedOaSyncAll('cron')
        console.log('[oa-sync-scheduler] completed')
      } catch (e) {
        console.error('[oa-sync-scheduler] failed', e)
      } finally {
        planNext()
      }
    }, delayMs)
  }

  planNext()
}
