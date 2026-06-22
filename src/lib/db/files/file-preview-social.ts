import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { handleDbError } from '@/lib/db/handle-db-error'
import { BusinessError } from '@/lib/errors'
import { resolveAvatarUrl } from '@/lib/storage/avatar-url'
import {
  FILE_INTERACTION_USER_ROLE_AT_VIEWER,
  type FileInteractionTypeValue,
} from '@/types/file-interactions'
import type {
  FilePreviewCommentRow,
  FilePreviewRecommendStats,
} from '@/types/file-preview'

const TOP_LEVEL_COMMENT_LIMIT = 80
const THREAD_REPLY_LIMIT = 200

type CommentRowDb = {
  id: string
  content: string
  created_at: string | null
  user_id: string
  parent_id: string | null
}

async function fetchUserMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[]
): Promise<
  Map<string, { name: string; avatarUrl: string | null }>
> {
  if (userIds.length === 0) return new Map()
  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, name, avatar_url')
    .in('id', [...new Set(userIds)])

  if (uErr) handleDbError(uErr)
  return new Map(
    (users ?? []).map((u) => [
      u.id as string,
      {
        name: (u.name as string)?.trim() || '',
        avatarUrl: resolveAvatarUrl(u.avatar_url as string | null) ?? null,
      },
    ])
  )
}

function mapToPreviewRow(
  r: CommentRowDb,
  userMap: Map<string, { name: string; avatarUrl: string | null }>,
  rootCommentId: string,
  parentAuthorName: string | null
): FilePreviewCommentRow {
  const u = userMap.get(r.user_id as string)
  return {
    id: r.id as string,
    parentId: (r.parent_id as string | null) ?? null,
    rootCommentId,
    content: r.content as string,
    createdAt: r.created_at != null ? String(r.created_at) : '',
    userName: u?.name || '用户',
    userId: r.user_id as string,
    avatarUrl: u?.avatarUrl ?? null,
    replyToUserName: parentAuthorName,
  }
}

/** 沿 parent_id 向上直到顶层，返回该楼 id */
async function resolveRootCommentId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fileId: string,
  startId: string
): Promise<string> {
  let cur: string | null = startId
  for (let i = 0; i < 40; i++) {
    const { data, error } = await supabase
      .from('file_comments')
      .select('id, parent_id')
      .eq('id', cur)
      .eq('file_id', fileId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) handleDbError(error)
    if (!data) throw new BusinessError('评论数据异常')
    const pid = data.parent_id as string | null
    if (!pid) return data.id as string
    cur = pid
  }
  throw new BusinessError('评论层级过深')
}

export async function getUserFileInteractionsForFile(
  userId: string,
  fileId: string
): Promise<{ favorite: boolean; recommend: boolean }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('file_interactions')
    .select('interaction_type')
    .eq('file_id', fileId)
    .eq('user_id', userId)
    .in('interaction_type', ['favorite', 'recommend'])

  if (error) handleDbError(error)
  const set = new Set((data ?? []).map((r) => r.interaction_type))
  return {
    favorite: set.has('favorite'),
    recommend: set.has('recommend'),
  }
}

export async function getFileRecommendStats(
  fileId: string
): Promise<FilePreviewRecommendStats> {
  const supabase = await createClient()
  const { count, error: cErr } = await supabase
    .from('file_interactions')
    .select('id', { count: 'exact', head: true })
    .eq('file_id', fileId)
    .eq('interaction_type', 'recommend')

  if (cErr) handleDbError(cErr)

  const { data: rows, error } = await supabase
    .from('file_interactions')
    .select('user_id, created_at')
    .eq('file_id', fileId)
    .eq('interaction_type', 'recommend')
    .order('created_at', { ascending: false })
    .limit(36)

  if (error) handleDbError(error)

  const seen = new Set<string>()
  const userIds: string[] = []
  for (const r of rows ?? []) {
    const uid = r.user_id as string
    if (!seen.has(uid)) {
      seen.add(uid)
      userIds.push(uid)
      if (userIds.length >= 6) break
    }
  }

  if (userIds.length === 0) {
    return { count: count ?? 0, sampleUsers: [] }
  }

  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, name, avatar_url')
    .in('id', userIds)

  if (uErr) handleDbError(uErr)
  const orderMap = new Map(userIds.map((id, i) => [id, i]))
  const sampleUsers = (users ?? [])
    .slice()
    .sort(
      (a, b) =>
        (orderMap.get(a.id as string) ?? 0) -
        (orderMap.get(b.id as string) ?? 0)
    )
    .map((u) => ({
      userId: u.id as string,
      name: (u.name as string)?.trim() || '用户',
      avatarUrl: resolveAvatarUrl(u.avatar_url as string | null) ?? null,
    }))

  return { count: count ?? 0, sampleUsers }
}

export async function toggleFileInteractionForUser(
  userId: string,
  fileId: string,
  type: FileInteractionTypeValue
): Promise<{ favorite: boolean; recommend: boolean }> {
  const supabase = await createClient()
  const { data: removed, error: delErr } = await supabase
    .from('file_interactions')
    .delete()
    .eq('file_id', fileId)
    .eq('user_id', userId)
    .eq('interaction_type', type)
    .select('id')

  if (delErr) handleDbError(delErr)

  if (!removed?.length) {
    const { error: insErr } = await supabase.from('file_interactions').insert({
      file_id: fileId,
      user_id: userId,
      interaction_type: type,
      user_role_at_time: FILE_INTERACTION_USER_ROLE_AT_VIEWER,
    })
    if (insErr) handleDbError(insErr)
  }

  return getUserFileInteractionsForFile(userId, fileId)
}

/** 仅一级评论（parent_id 为空） */
export async function listTopLevelFileComments(
  fileId: string
): Promise<FilePreviewCommentRow[]> {
  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from('file_comments')
    .select('id, content, created_at, user_id, parent_id')
    .eq('file_id', fileId)
    .is('deleted_at', null)
    .is('parent_id', null)
    .order('created_at', { ascending: true })
    .limit(TOP_LEVEL_COMMENT_LIMIT)

  if (error) handleDbError(error)
  const list = (rows ?? []) as CommentRowDb[]
  if (list.length === 0) return []

  const uids = [...new Set(list.map((r) => r.user_id))]
  const userMap = await fetchUserMap(supabase, uids)

  return list.map((r) =>
    mapToPreviewRow(r, userMap, r.id, null)
  )
}

/**
 * 某楼全部回复（不含顶层自身）：按 parent_id BFS 拉取子树，平铺后按时间排序。
 */
export async function listFileCommentThreadReplies(
  fileId: string,
  rootCommentId: string
): Promise<FilePreviewCommentRow[]> {
  const supabase = await createClient()

  const { data: root, error: rootErr } = await supabase
    .from('file_comments')
    .select('id, parent_id')
    .eq('id', rootCommentId)
    .eq('file_id', fileId)
    .is('deleted_at', null)
    .maybeSingle()

  if (rootErr) handleDbError(rootErr)
  if (!root || (root.parent_id as string | null) != null) {
    throw new BusinessError('评论不存在或不是一级评论')
  }

  const collected: CommentRowDb[] = []
  let frontier: string[] = [rootCommentId]
  const seen = new Set<string>()

  while (frontier.length > 0 && collected.length < THREAD_REPLY_LIMIT) {
    const { data: batch, error: bErr } = await supabase
      .from('file_comments')
      .select('id, content, created_at, user_id, parent_id')
      .eq('file_id', fileId)
      .is('deleted_at', null)
      .in('parent_id', frontier)

    if (bErr) handleDbError(bErr)
    const part = (batch ?? []) as CommentRowDb[]
    if (part.length === 0) break

    const nextFrontier: string[] = []
    for (const r of part) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      collected.push(r)
      nextFrontier.push(r.id)
    }
    frontier = nextFrontier
  }

  collected.sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at))
  )

  if (collected.length === 0) return []

  const uids = [...new Set(collected.map((r) => r.user_id))]
  const parentIds = [
    ...new Set(
      collected.map((r) => r.parent_id).filter((x): x is string => !!x)
    ),
  ]

  const { data: parentRows, error: pErr } = await supabase
    .from('file_comments')
    .select('id, user_id')
    .eq('file_id', fileId)
    .in('id', parentIds)

  if (pErr) handleDbError(pErr)
  const parentUidById = new Map(
    (parentRows ?? []).map((p) => [p.id as string, p.user_id as string])
  )

  const allUids = [...new Set([...uids, ...parentUidById.values()])]
  const userMap = await fetchUserMap(supabase, allUids)

  return collected.map((r) => {
    const puid = r.parent_id ? parentUidById.get(r.parent_id) : null
    const parentAuthor = puid
      ? userMap.get(puid)?.name?.trim() || null
      : null
    return mapToPreviewRow(
      r,
      userMap,
      rootCommentId,
      parentAuthor
    )
  })
}

export async function insertFileCommentForPreview(
  userId: string,
  fileId: string,
  content: string,
  parentId: string | null
): Promise<FilePreviewCommentRow> {
  const supabase = await createClient()

  let replyToUserName: string | null = null
  let rootCommentId: string | null = null

  if (parentId) {
    const { data: parent, error: pErr } = await supabase
      .from('file_comments')
      .select('id, user_id, parent_id')
      .eq('id', parentId)
      .eq('file_id', fileId)
      .is('deleted_at', null)
      .maybeSingle()
    if (pErr) handleDbError(pErr)
    if (!parent) throw new BusinessError('回复的评论不存在或已删除')

    const pmap = await fetchUserMap(supabase, [parent.user_id as string])
    replyToUserName = pmap.get(parent.user_id as string)?.name || '用户'
    rootCommentId = await resolveRootCommentId(supabase, fileId, parentId)
  }

  const id = randomUUID()
  if (!parentId) {
    rootCommentId = id
  }

  const { data: row, error } = await supabase
    .from('file_comments')
    .insert({
      id,
      file_id: fileId,
      user_id: userId,
      content,
      is_public: true,
      ...(parentId ? { parent_id: parentId } : {}),
    })
    .select('id, content, created_at, parent_id')
    .single()

  if (error) handleDbError(error)
  if (!row) throw new BusinessError('写入评论失败')

  const rid = row.id as string
  const finalRoot: string = parentId ? (rootCommentId as string) : rid

  const { data: u } = await supabase
    .from('users')
    .select('name, avatar_url')
    .eq('id', userId)
    .maybeSingle()

  return {
    id: rid,
    parentId: (row.parent_id as string | null) ?? null,
    rootCommentId: finalRoot,
    content: row.content as string,
    createdAt: row.created_at != null ? String(row.created_at) : '',
    userName: u?.name?.trim() || '用户',
    userId,
    avatarUrl: resolveAvatarUrl(u?.avatar_url as string | null) ?? null,
    replyToUserName,
  }
}
