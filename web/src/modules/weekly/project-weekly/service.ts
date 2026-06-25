import { requireUser } from '@/core/auth'
import { BusinessError, NotFoundError, ValidationError } from '@/core/errors'
import { assertProjectAccess } from '../projects/service'
import {
  buildProjectWeekExcelBuffer,
  sanitizeExcelFileName,
} from '@/modules/weekly/lib/build-project-week-excel'
import {
  getProjectWeeklyWeeksPage,
  getProjectWeekWorkItemsPage,
} from './repo'

export interface ExportProjectWeekExcelResult {
  fileName: string
  fileContent: string
}

export async function loadProjectWeeklyWeeks(
  projectId: string,
  weekOffset: number,
  weekLimit?: number
) {
  await assertProjectAccess(projectId)
  return getProjectWeeklyWeeksPage(projectId, weekOffset, weekLimit)
}

export async function loadProjectWeekWorkItems(
  projectId: string,
  weekCode: string
) {
  await assertProjectAccess(projectId)
  const page = await getProjectWeekWorkItemsPage(projectId, weekCode)
  if (!page) throw new NotFoundError('该周次不在本项目周报范围内')
  return page
}

export async function exportProjectWeekExcel(input: {
  projectId: string
  weekCode: string
}): Promise<ExportProjectWeekExcelResult> {
  await requireUser()
  const projectId = input.projectId?.trim()
  const weekCode = input.weekCode?.trim()
  if (!projectId || !weekCode) throw new ValidationError('参数无效')

  await assertProjectAccess(projectId)

  const data = await getProjectWeekWorkItemsPage(projectId, weekCode)
  if (!data) throw new BusinessError('该周暂无周报数据或无权查看')

  const buffer = await buildProjectWeekExcelBuffer(data)
  const base = sanitizeExcelFileName(
    `${data.projectName?.trim() || '项目'}_${data.title_zh}`
  )
  const fileName = `${base}_周报.xlsx`

  return {
    fileName,
    fileContent: buffer.toString('base64'),
  }
}
