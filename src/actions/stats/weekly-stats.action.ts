'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError, ValidationError } from '@/lib/errors'
import { getProfileById } from '@/lib/db/auth/profile'
import { assertDeptStatsAccess } from '@/lib/db/stats/stats-access'
import {
  getWeeklyDeptByPerson,
  getWeeklyDeptByProject,
  getWeeklyDeptDetails,
  type WeeklyDeptStatsParams,
} from '@/lib/db/stats/weekly-dept-stats'
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

function buildParams(
  departmentId: string,
  weekCode: string,
  personNameKeyword?: string | null,
  projectKeyword?: string | null
): WeeklyDeptStatsParams {
  const d = departmentId?.trim()
  const w = weekCode?.trim()
  if (!d) throw new ValidationError('请选择部门')
  if (!w) throw new ValidationError('请选择周次')
  return {
    departmentId: d,
    weekCode: w,
    personNameKeyword: personNameKeyword?.trim() || undefined,
    projectKeyword: projectKeyword?.trim() || undefined,
  }
}

export async function loadWeeklyDeptByPerson(
  departmentId: string,
  weekCode: string,
  personNameKeyword?: string | null,
  projectKeyword?: string | null
) {
  return handleAction(async () => {
    const profile = await requireProfile()
    await assertDeptStatsAccess(profile, departmentId)
    const params = buildParams(departmentId, weekCode, personNameKeyword, projectKeyword)
    return getWeeklyDeptByPerson(params)
  })
}

export async function loadWeeklyDeptByProject(
  departmentId: string,
  weekCode: string,
  personNameKeyword?: string | null,
  projectKeyword?: string | null
) {
  return handleAction(async () => {
    const profile = await requireProfile()
    await assertDeptStatsAccess(profile, departmentId)
    const params = buildParams(departmentId, weekCode, personNameKeyword, projectKeyword)
    return getWeeklyDeptByProject(params)
  })
}

export async function loadWeeklyDeptDetails(
  departmentId: string,
  weekCode: string,
  personNameKeyword?: string | null,
  projectKeyword?: string | null
) {
  return handleAction(async () => {
    const profile = await requireProfile()
    await assertDeptStatsAccess(profile, departmentId)
    const params = buildParams(departmentId, weekCode, personNameKeyword, projectKeyword)
    return getWeeklyDeptDetails(params)
  })
}
