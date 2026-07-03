import { syncDepartmentsFromOa } from '@/modules/org/departments/repo'
import {
  fetchOaPgrestAll,
  type OaPgrestClientOptions,
} from '../adapters/pgrest-client'
import { mapOaDepartmentRows } from '../mappers/department.mapper'
import type { OaDepartmentRow, OaSyncStats } from '../types'

const OA_DEPARTMENT_PATH = '/pgrest/to_iws_dept_info'

export async function syncOaDepartments(
  options: OaPgrestClientOptions = {}
): Promise<OaSyncStats> {
  const syncedAt = new Date()
  const rows = await fetchOaPgrestAll<OaDepartmentRow>(
    OA_DEPARTMENT_PATH,
    options
  )
  const items = mapOaDepartmentRows(rows, syncedAt)
  return syncDepartmentsFromOa(items)
}
