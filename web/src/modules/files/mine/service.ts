import { requireUser } from '@/core/auth'
import { parseProjectStage } from '@/constants/project-stage'
import { getMyUploadedFilesPage, listMyUploadedFileProjects } from './repo'
import { MINE_FILES_PAGE_SIZE } from '../types'

export async function loadMineFilesPage(input: {
  offset: number
  fileNameQuery?: string | null
  projectId?: string | null
  projectStage?: string | null
}) {
  const user = await requireUser()
  return getMyUploadedFilesPage({
    userId: user.id,
    offset: Math.max(0, input.offset),
    limit: MINE_FILES_PAGE_SIZE,
    fileNameQuery: input.fileNameQuery?.trim() ? input.fileNameQuery : null,
    projectId: input.projectId?.trim() ? input.projectId : null,
    projectStage: parseProjectStage(input.projectStage ?? null),
  })
}

export async function loadMyUploadedFileProjects() {
  const user = await requireUser()
  return listMyUploadedFileProjects(user.id)
}

export { MINE_FILES_PAGE_SIZE }
