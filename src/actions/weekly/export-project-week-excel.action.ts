'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError, BusinessError } from '@/lib/errors'
import { getProfileById } from '@/lib/db/auth/profile'
import { canAccessWeeklyProject } from '@/lib/db/weekly/projects'
import { getProjectWeekWorkItemsPage } from '@/lib/db/weekly/project-weekly-tab'
import {
  buildProjectWeekExcelBuffer,
  sanitizeExcelFileName,
} from '@/lib/weekly/build-project-week-excel'

async function requireProfile() {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AuthError('请先登录')

  const profile = await getProfileById(user.id)
  if (!profile) throw new AuthError('请先登录')
  return profile
}

export interface ExportProjectWeekExcelResult {
  fileName: string
  fileContent: string
}

export async function exportProjectWeekExcel(input: {
  projectId: string
  weekCode: string
}) {
  return handleAction(async (): Promise<ExportProjectWeekExcelResult> => {
    const profile = await requireProfile()
    const projectId = input.projectId?.trim()
    const weekCode = input.weekCode?.trim()
    if (!projectId || !weekCode) throw new BusinessError('参数无效')

    const allowed = await canAccessWeeklyProject(
      {
        userId: profile.id,
        role: profile.role,
        userDepartmentId: profile.department_id,
      },
      projectId
    )
    if (!allowed) throw new BusinessError('无权访问该项目')

    const data = await getProjectWeekWorkItemsPage(projectId, weekCode)
    if (!data) throw new BusinessError('该周暂无周报数据或无权查看')

    const buffer = await buildProjectWeekExcelBuffer(data)
    const base = sanitizeExcelFileName(
      (data.projectName?.trim() || '项目') + '_' + data.title_zh
    )
    const fileName = `${base}_周报.xlsx`

    return {
      fileName,
      fileContent: buffer.toString('base64'),
    }
  })
}
