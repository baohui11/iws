'use server'

import { run } from '@/core/result'
import * as svc from './service'

export async function loadProjectWeeklyWeeksAction(
  projectId: string,
  weekOffset: number,
  weekLimit?: number
) {
  return run(() => svc.loadProjectWeeklyWeeks(projectId, weekOffset, weekLimit))
}

export async function loadProjectWeekWorkItemsAction(
  projectId: string,
  weekCode: string
) {
  return run(() => svc.loadProjectWeekWorkItems(projectId, weekCode))
}

export async function exportProjectWeekExcelAction(input: {
  projectId: string
  weekCode: string
}) {
  return run(() => svc.exportProjectWeekExcel(input))
}
