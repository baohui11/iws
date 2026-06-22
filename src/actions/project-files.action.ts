'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError, BusinessError, ValidationError } from '@/lib/errors'
import { getProfileById } from '@/lib/db/auth/profile'
import { listProjectFilesPage } from '@/lib/db/project-files'
import { canAccessWeeklyProject } from '@/lib/db/weekly/projects'
import { createClient } from '@/lib/supabase/server'
import type { ListProjectFilesFilters } from '@/types/project-files'

async function requireProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AuthError('请先登录')

  const profile = await getProfileById(user.id)
  if (!profile) throw new AuthError('请先登录')
  return profile
}

function weeklyAccessCtx(profile: Awaited<ReturnType<typeof requireProfile>>) {
  return {
    userId: profile.id,
    role: profile.role,
    userDepartmentId: profile.department_id,
  }
}

const MAX_PAGE = 50

export async function loadProjectFilesPage(
  projectId: string,
  filters: ListProjectFilesFilters,
  offset: number,
  limit: number
) {
  return handleAction(async () => {
    const profile = await requireProfile()
    const pid = projectId?.trim()
    if (!pid) throw new ValidationError('项目无效')

    const allowed = await canAccessWeeklyProject(
      weeklyAccessCtx(profile),
      pid
    )
    if (!allowed) {
      throw new BusinessError('无权访问该项目')
    }

    const lim = Math.min(Math.max(1, limit), MAX_PAGE)
    const off = Math.max(0, offset)
    return listProjectFilesPage(pid, filters, off, lim)
  })
}

