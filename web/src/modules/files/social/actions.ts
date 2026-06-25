'use server'

import { run } from '@/core/result'
import * as svc from './service'

export async function toggleFileFavoriteAction(fileId: string) {
  return run(() => svc.toggleFileFavorite(fileId))
}

export async function toggleFileRecommendAction(fileId: string) {
  return run(() => svc.toggleFileRecommend(fileId))
}

export async function addFileCommentAction(
  fileId: string,
  content: string,
  parentId?: string | null
) {
  return run(() => svc.addFileComment(fileId, content, parentId))
}

export async function loadFileCommentRepliesAction(
  fileId: string,
  rootCommentId: string
) {
  return run(() => svc.loadFileCommentReplies(fileId, rootCommentId))
}
