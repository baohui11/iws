'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError } from '@/lib/errors'
import { getProfileById } from '@/lib/db/auth/profile'
import {
  getMyFilesMinePage,
  MINE_FILES_PAGE_SIZE,
  type FilesMineTab,
} from '@/lib/db/files/mine-files'

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

export async function loadMineFilesPageAction(input: {
  tab: FilesMineTab
  offset: number
  fileNameQuery?: string | null
}) {
  return handleAction(async () => {
    const profile = await requireProfile()
    return getMyFilesMinePage(
      profile.id,
      input.tab,
      Math.max(0, input.offset),
      MINE_FILES_PAGE_SIZE,
      input.fileNameQuery?.trim() ? input.fileNameQuery : null
    )
  })
}
