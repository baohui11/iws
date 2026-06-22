'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError, ValidationError } from '@/lib/errors'
import { getProfileById } from '@/lib/db/auth/profile'
import { getMyAttendanceDetails } from '@/lib/db/stats/attendance-stats'
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

function assertYearMonth(v: string): string {
  const s = v?.trim()
  if (!s || !/^\d{4}-\d{2}$/.test(s)) {
    throw new ValidationError('请选择有效月份（YYYY-MM）')
  }
  const m = Number(s.slice(5, 7))
  if (m < 1 || m > 12) throw new ValidationError('月份无效')
  return s
}

export async function loadMyAttendanceDetails(yearMonth: string) {
  return handleAction(async () => {
    const profile = await requireProfile()
    const ym = assertYearMonth(yearMonth)
    return getMyAttendanceDetails(profile.id, ym)
  })
}
