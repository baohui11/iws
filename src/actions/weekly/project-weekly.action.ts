'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError, BusinessError } from '@/lib/errors'
import { getProfileById } from '@/lib/db/auth/profile'
import { canAccessWeeklyProject } from '@/lib/db/weekly/projects'
import { getProjectWeeklyWeeksPage } from '@/lib/db/weekly/project-weekly-tab'
import { WEEKLY_PROJECT_WEEKS_PAGE_SIZE } from '@/constants/weekly-reports-list'

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

export async function loadProjectWeeklyWeeks(input: {
  projectId: string
  weekOffset: number
  weekLimit?: number
}) {
  return handleAction(async () => {
    const profile = await requireProfile()
    const pid = input.projectId?.trim()
    if (!pid) throw new BusinessError('项目无效')

    const allowed = await canAccessWeeklyProject(
      {
        userId: profile.id,
        role: profile.role,
        userDepartmentId: profile.department_id,
      },
      pid
    )
    if (!allowed) throw new BusinessError('无权访问该项目')

    return getProjectWeeklyWeeksPage(
      pid,
      Math.max(0, input.weekOffset),
      input.weekLimit ?? WEEKLY_PROJECT_WEEKS_PAGE_SIZE
    )
  })
}
