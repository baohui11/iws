'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError } from '@/lib/errors'
import { getProfileById } from '@/lib/db/auth/profile'
import {
  getMyWeeklyProjectsList,
  canAccessWeeklyProject,
  getWeeklyProjectSummaryById,
  type WeeklyMyProjectsParams,
} from '@/lib/db/weekly/projects'
import { createClient } from '@/lib/supabase/server'

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

function toWeeklyParams(
  profile: Awaited<ReturnType<typeof requireProfile>>,
  input: Omit<
    WeeklyMyProjectsParams,
    'userId' | 'role' | 'userDepartmentId'
  >
): WeeklyMyProjectsParams {
  return {
    userId: profile.id,
    role: profile.role,
    userDepartmentId: profile.department_id,
    ...input,
  }
}

export async function listMyWeeklyProjects(
  input: Omit<
    WeeklyMyProjectsParams,
    'userId' | 'role' | 'userDepartmentId'
  > = {}
) {
  return handleAction(async () => {
    const profile = await requireProfile()
    return getMyWeeklyProjectsList(toWeeklyParams(profile, input))
  })
}

export async function getWeeklyProjectForViewer(projectId: string) {
  return handleAction(async () => {
    const profile = await requireProfile()
    if (!projectId?.trim()) {
      return null
    }
    const id = projectId.trim()
    const ok = await canAccessWeeklyProject(
      {
        userId: profile.id,
        role: profile.role,
        userDepartmentId: profile.department_id,
      },
      id
    )
    if (!ok) return null
    return getWeeklyProjectSummaryById(id)
  })
}
