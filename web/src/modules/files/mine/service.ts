import { requireUser } from '@/core/auth'
import { getMyFilesMinePage } from './repo'
import type { FilesMineTab } from '../types'
import { MINE_FILES_PAGE_SIZE } from '../types'

export async function loadMineFilesPage(input: {
  tab: FilesMineTab
  offset: number
  fileNameQuery?: string | null
}) {
  const user = await requireUser()
  return getMyFilesMinePage(
    user.id,
    input.tab,
    Math.max(0, input.offset),
    MINE_FILES_PAGE_SIZE,
    input.fileNameQuery?.trim() ? input.fileNameQuery : null
  )
}

export { MINE_FILES_PAGE_SIZE }
