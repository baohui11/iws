'use server'

import { handleAction } from '@/lib/action-handler'
import {
  AuthError,
  BusinessError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors'
import { getProfileById } from '@/lib/db/auth/profile'
import { canAccessFileBinary } from '@/lib/db/files/file-preview-access'
import { getFileRowForPreview } from '@/lib/db/files/file-preview'
import { createClient } from '@/lib/supabase/server'
import {
  getFileRecommendStats,
  insertFileCommentForPreview,
  listFileCommentThreadReplies,
  toggleFileInteractionForUser,
} from '@/lib/db/files/file-preview-social'
import type {
  FilePreviewCommentRow,
  FilePreviewRecommendStats,
} from '@/types/file-preview'

const MAX_COMMENT_LEN = 2000

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

async function requirePreviewFileAccess(fileId: string) {
  const profile = await requireProfile()
  const row = await getFileRowForPreview(fileId)
  if (!row) throw new NotFoundError('文件不存在')
  if (!canAccessFileBinary(profile, row)) {
    throw new BusinessError('无权操作该文件')
  }
  return { profile, row }
}

export async function toggleFileFavoriteAction(fileId: string) {
  return handleAction(
    async (): Promise<{
      interactions: { favorite: boolean; recommend: boolean }
      recommendStats: FilePreviewRecommendStats
    }> => {
      const id = fileId?.trim()
      if (!id) throw new ValidationError('文件 ID 无效')
      const { profile } = await requirePreviewFileAccess(id)
      const interactions = await toggleFileInteractionForUser(
        profile.id,
        id,
        'favorite'
      )
      const recommendStats = await getFileRecommendStats(id)
      return { interactions, recommendStats }
    }
  )
}

export async function toggleFileRecommendAction(fileId: string) {
  return handleAction(
    async (): Promise<{
      interactions: { favorite: boolean; recommend: boolean }
      recommendStats: FilePreviewRecommendStats
    }> => {
      const id = fileId?.trim()
      if (!id) throw new ValidationError('文件 ID 无效')
      const { profile } = await requirePreviewFileAccess(id)
      const interactions = await toggleFileInteractionForUser(
        profile.id,
        id,
        'recommend'
      )
      const recommendStats = await getFileRecommendStats(id)
      return { interactions, recommendStats }
    }
  )
}

export async function addFileCommentAction(
  fileId: string,
  content: string,
  parentId?: string | null
) {
  return handleAction(async (): Promise<FilePreviewCommentRow> => {
    const id = fileId?.trim()
    if (!id) throw new ValidationError('文件 ID 无效')
    const trimmed = content?.trim() ?? ''
    if (!trimmed) throw new ValidationError('请输入评论内容')
    if (trimmed.length > MAX_COMMENT_LEN) {
      throw new ValidationError(`评论请勿超过 ${MAX_COMMENT_LEN} 字`)
    }
    const { profile } = await requirePreviewFileAccess(id)
    const pid = parentId?.trim() ? parentId.trim() : null
    return insertFileCommentForPreview(profile.id, id, trimmed, pid)
  })
}

export async function loadFileCommentRepliesAction(
  fileId: string,
  rootCommentId: string
) {
  return handleAction(async (): Promise<FilePreviewCommentRow[]> => {
    const id = fileId?.trim()
    const root = rootCommentId?.trim()
    if (!id || !root) throw new ValidationError('参数无效')
    await requirePreviewFileAccess(id)
    return listFileCommentThreadReplies(id, root)
  })
}
