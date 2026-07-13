import { requireUser } from '@/core/auth'
import { BusinessError, NotFoundError, ValidationError } from '@/core/errors'
import { canAccessFileBinary } from '../preview/access'
import { getFileRowForPreview } from '../preview/repo'
import {
  getFileRecommendStats,
  insertFileCommentForPreview,
  listFileCommentThreadReplies,
  toggleFileInteractionForUser,
} from '../social/repo'
import type {
  FilePreviewCommentRow,
  FilePreviewRecommendStats,
} from '../types'

const MAX_COMMENT_LEN = 2000

async function requirePreviewFileAccess(fileId: string) {
  const user = await requireUser()
  const row = await getFileRowForPreview(fileId)
  if (!row) throw new NotFoundError('文件不存在')
  if (!(await canAccessFileBinary(user, row))) {
    throw new BusinessError('无权操作该文件')
  }
  return { user, row }
}

export async function toggleFileFavorite(fileId: string): Promise<{
  interactions: { favorite: boolean; recommend: boolean }
  recommendStats: FilePreviewRecommendStats
}> {
  const id = fileId?.trim()
  if (!id) throw new ValidationError('文件 ID 无效')
  const { user } = await requirePreviewFileAccess(id)
  const interactions = await toggleFileInteractionForUser(
    user.id,
    id,
    'favorite'
  )
  const recommendStats = await getFileRecommendStats(id)
  return { interactions, recommendStats }
}

export async function toggleFileRecommend(fileId: string): Promise<{
  interactions: { favorite: boolean; recommend: boolean }
  recommendStats: FilePreviewRecommendStats
}> {
  const id = fileId?.trim()
  if (!id) throw new ValidationError('文件 ID 无效')
  const { user } = await requirePreviewFileAccess(id)
  const interactions = await toggleFileInteractionForUser(
    user.id,
    id,
    'recommend'
  )
  const recommendStats = await getFileRecommendStats(id)
  return { interactions, recommendStats }
}

export async function addFileComment(
  fileId: string,
  content: string,
  parentId?: string | null
): Promise<FilePreviewCommentRow> {
  const id = fileId?.trim()
  if (!id) throw new ValidationError('文件 ID 无效')
  const trimmed = content?.trim() ?? ''
  if (!trimmed) throw new ValidationError('请输入评论内容')
  if (trimmed.length > MAX_COMMENT_LEN) {
    throw new ValidationError(`评论请勿超过 ${MAX_COMMENT_LEN} 字`)
  }
  const { user } = await requirePreviewFileAccess(id)
  const pid = parentId?.trim() ? parentId.trim() : null
  return insertFileCommentForPreview(user.id, id, trimmed, pid)
}

export async function loadFileCommentReplies(
  fileId: string,
  rootCommentId: string
): Promise<FilePreviewCommentRow[]> {
  const id = fileId?.trim()
  const root = rootCommentId?.trim()
  if (!id || !root) throw new ValidationError('参数无效')
  await requirePreviewFileAccess(id)
  return listFileCommentThreadReplies(id, root)
}
