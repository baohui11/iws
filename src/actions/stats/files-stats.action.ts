'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError, ValidationError } from '@/lib/errors'
import { getProfileById } from '@/lib/db/auth/profile'
import { assertDeptStatsAccess, assertStatsRole } from '@/lib/db/stats/stats-access'
import { listFilesStatsPage } from '@/lib/db/stats/files-stats'
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

export async function loadFilesStatsPage(
  departmentId: string | null,
  fileNameKeyword: string | null,
  projectKeyword: string | null,
  offset: number,
  limit: number
) {
  return handleAction(async () => {
    const profile = await requireProfile()
    assertStatsRole(profile)

    const did = departmentId?.trim() || null
    if (profile.role !== 'admin' && !did) {
      throw new ValidationError('请选择部门')
    }
    if (profile.role !== 'admin' && did) {
      await assertDeptStatsAccess(profile, did)
    }

    return listFilesStatsPage({
      role: profile.role,
      departmentId: profile.role === 'admin' ? did : did,
      fileNameKeyword: fileNameKeyword?.trim() || null,
      projectKeyword: projectKeyword?.trim() || null,
      offset,
      limit,
    })
  })
}
