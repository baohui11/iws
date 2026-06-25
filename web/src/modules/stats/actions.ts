'use server'

import { run } from '@/core/result'
import * as svc from './service'

export async function loadMyAttendanceDetailsAction(yearMonth: string) {
  return run(() => svc.loadMyAttendanceDetails(yearMonth))
}

export async function loadAttendanceSummaryAction(departmentId: string, yearMonth: string) {
  return run(() => svc.loadAttendanceSummary(departmentId, yearMonth))
}

export async function loadAttendanceDetailsAction(departmentId: string, yearMonth: string) {
  return run(() => svc.loadAttendanceDetails(departmentId, yearMonth))
}

export async function loadAttendanceProjectSummaryAction(
  departmentId: string,
  yearMonth: string
) {
  return run(() => svc.loadAttendanceProjectSummary(departmentId, yearMonth))
}

export async function loadFilesStatsPageAction(
  departmentId: string | null,
  fileNameKeyword: string | null,
  projectKeyword: string | null,
  offset: number,
  limit: number
) {
  return run(() =>
    svc.loadFilesStatsPage(departmentId, fileNameKeyword, projectKeyword, offset, limit)
  )
}

export async function loadFileDownloadByPersonAction(input: {
  dateFrom: string
  dateTo: string
  nameKeyword: string | null
}) {
  return run(() => svc.loadFileDownloadByPerson(input))
}

export async function loadFileDownloadDetailsAction(input: {
  dateFrom: string
  dateTo: string
  nameKeyword: string | null
  offset: number
  limit: number
}) {
  return run(() => svc.loadFileDownloadDetails(input))
}

export async function loadWeeklyDeptByPersonAction(
  departmentId: string,
  weekCode: string,
  personNameKeyword?: string | null,
  projectKeyword?: string | null
) {
  return run(() =>
    svc.loadWeeklyDeptByPerson(departmentId, weekCode, personNameKeyword, projectKeyword)
  )
}

export async function loadWeeklyDeptByProjectAction(
  departmentId: string,
  weekCode: string,
  personNameKeyword?: string | null,
  projectKeyword?: string | null
) {
  return run(() =>
    svc.loadWeeklyDeptByProject(departmentId, weekCode, personNameKeyword, projectKeyword)
  )
}

export async function loadWeeklyDeptDetailsAction(
  departmentId: string,
  weekCode: string,
  personNameKeyword?: string | null,
  projectKeyword?: string | null
) {
  return run(() =>
    svc.loadWeeklyDeptDetails(departmentId, weekCode, personNameKeyword, projectKeyword)
  )
}
