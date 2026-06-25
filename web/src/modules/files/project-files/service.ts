import { requireUser } from '@/core/auth'
import { BusinessError, ValidationError } from '@/core/errors'
import { canAccessWeeklyProject } from '@/modules/weekly/projects/repo'
import { listProjectFilesPage } from './repo'
import type { ListProjectFilesFilters } from '../types'

const MAX_PAGE = 50

export async function loadProjectFilesPage(
  projectId: string,
  filters: ListProjectFilesFilters,
  offset: number,
  limit: number
) {
  const user = await requireUser()
  const pid = projectId?.trim()
  if (!pid) throw new ValidationError('项目无效')

  const allowed = await canAccessWeeklyProject(
    {
      userId: user.id,
      role: user.role,
      userDepartmentId: user.departmentId,
    },
    pid
  )
  if (!allowed) {
    throw new BusinessError('无权访问该项目')
  }

  const lim = Math.min(Math.max(1, limit), MAX_PAGE)
  const off = Math.max(0, offset)
  return listProjectFilesPage(pid, filters, off, lim)
}
