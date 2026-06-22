'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError } from '@/lib/errors'
import { getProfileById } from '@/lib/db/auth/profile'
import {
  getMyFilledReportsWithStats,
  getPmApprovalList,
} from '@/lib/db/weekly/reports'
import type { ApprovalDoneFilter } from '@/types/weekly-reports'

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

export async function loadMyFilledReports(input: {
  weekCodes: string[]
  projectIds: string[]
  offset?: number
  limit?: number
}) {
  return handleAction(async () => {
    const profile = await requireProfile()
    return getMyFilledReportsWithStats({
      userId: profile.id,
      weekCodes: input.weekCodes,
      projectIds: input.projectIds,
      offset: input.offset,
      limit: input.limit,
    })
  })
}

export async function loadPmApprovalList(input: {
  approvalFilter: ApprovalDoneFilter
  weekCodes: string[]
  projectIds: string[]
  offset?: number
  limit?: number
}) {
  return handleAction(async () => {
    const profile = await requireProfile()
    return getPmApprovalList({
      userId: profile.id,
      approvalFilter: input.approvalFilter,
      weekCodes: input.weekCodes,
      projectIds: input.projectIds,
      offset: input.offset,
      limit: input.limit,
    })
  })
}
