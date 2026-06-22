'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError } from '@/lib/errors'
import { getProfileById } from '@/lib/db/auth/profile'
import { assertStatsRole } from '@/lib/db/stats/stats-access'
import {
  getFileDownloadCountByPerson,
  listFileDownloadDetailsForAudit,
} from '@/lib/db/stats/file-download-audit'
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

export async function loadFileDownloadByPerson(input: {
  dateFrom: string
  dateTo: string
  nameKeyword: string | null
}) {
  return handleAction(async () => {
    const profile = await requireProfile()
    assertStatsRole(profile)
    return getFileDownloadCountByPerson({
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      nameKeyword: input.nameKeyword?.trim() || null,
    })
  })
}

export async function loadFileDownloadDetails(input: {
  dateFrom: string
  dateTo: string
  nameKeyword: string | null
  offset: number
  limit: number
}) {
  return handleAction(async () => {
    const profile = await requireProfile()
    assertStatsRole(profile)
    return listFileDownloadDetailsForAudit({
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      nameKeyword: input.nameKeyword?.trim() || null,
      offset: input.offset,
      limit: input.limit,
    })
  })
}
