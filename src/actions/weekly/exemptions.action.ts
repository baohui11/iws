'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError, ValidationError } from '@/lib/errors'
import { getProfileById } from '@/lib/db/auth/profile'
import {
  deletePmProjectWeekExemption,
  insertPmProjectWeekExemption,
} from '@/lib/db/weekly/exemptions'

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

export async function addProjectWeekExemption(input: {
  projectId: string
  weekCode: string
}) {
  return handleAction(async () => {
    const profile = await requireProfile()
    if (!input.projectId?.trim()) {
      throw new ValidationError('请选择项目')
    }
    if (!input.weekCode?.trim()) {
      throw new ValidationError('请选择周次')
    }
    await insertPmProjectWeekExemption({
      userId: profile.id,
      projectId: input.projectId.trim(),
      weekCode: input.weekCode.trim(),
    })
  })
}

export async function removeProjectWeekExemption(exemptionId: string) {
  return handleAction(async () => {
    const profile = await requireProfile()
    if (!exemptionId?.trim()) {
      throw new ValidationError('参数无效')
    }
    await deletePmProjectWeekExemption(profile.id, exemptionId.trim())
  })
}
