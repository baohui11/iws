import { randomUUID } from 'node:crypto'
import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import {
  fileComments,
  fileInteractions,
  users,
} from '@/core/db/schema'
import { resolveAvatarUrl } from '@/core/storage/buckets'
import { BusinessError } from '@/core/errors'
import {
  FILE_INTERACTION_USER_ROLE_AT_VIEWER,
  type FileInteractionTypeValue,
  type FilePreviewCommentRow,
  type FilePreviewRecommendStats,
} from '../types'

const TOP_LEVEL_COMMENT_LIMIT = 80
const THREAD_REPLY_LIMIT = 200

type CommentRowDb = {
  id: string
  content: string
  created_at: Date | string | null
  user_id: string
  parent_id: string | null
}

function toIsoString(d: Date | string | null | undefined): string {
  if (d == null) return ''
  return d instanceof Date ? d.toISOString() : String(d)
}

async function fetchUserMap(
  userIds: string[]
): Promise<Map<string, { name: string; avatarUrl: string | null }>> {
  if (userIds.length === 0) return new Map()
  const db = getDb()
  const uniqueIds = [...new Set(userIds)]
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      avatar_url: users.avatarUrl,
    })
    .from(users)
    .where(inArray(users.id, uniqueIds))

  return new Map(
    rows.map((u) => [
      u.id,
      {
        name: u.name?.trim() || '',
        avatarUrl: resolveAvatarUrl(u.avatar_url) ?? null,
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
  const u = userMap.get(r.user_id)
  return {
    id: r.id,
    parentId: r.parent_id ?? null,
    rootCommentId,
    content: r.content,
    createdAt: toIsoString(r.created_at),
    userName: u?.name || '用户',
    userId: r.user_id,
    avatarUrl: u?.avatarUrl ?? null,
    replyToUserName: parentAuthorName,
  }
}

/** 沿 parent_id 向上直到顶层，返回该楼 id */
async function resolveRootCommentId(
  fileId: string,
  startId: string
): Promise<string> {
  const db = getDb()
  let cur: string = startId
  for (let i = 0; i < 40; i++) {
    const rows = await db
      .select({
        id: fileComments.id,
        parent_id: fileComments.parentId,
      })
      .from(fileComments)
      .where(
        and(
          eq(fileComments.id, cur),
          eq(fileComments.fileId, fileId),
          isNull(fileComments.deletedAt)
        )
      )
      .limit(1)

    const data = rows[0]
    if (!data) throw new BusinessError('评论数据异常')
    const pid = data.parent_id
    if (!pid) return data.id
    cur = pid
  }
  throw new BusinessError('评论层级过深')
}

export async function getUserFileInteractionsForFile(
  userId: string,
  fileId: string
): Promise<{ favorite: boolean; recommend: boolean }> {
  const db = getDb()
  const rows = await db
    .select({ interaction_type: fileInteractions.interactionType })
    .from(fileInteractions)
    .where(
      and(
        eq(fileInteractions.fileId, fileId),
        eq(fileInteractions.userId, userId),
        inArray(fileInteractions.interactionType, ['favorite', 'recommend'])
      )
    )

  const set = new Set(rows.map((r) => r.interaction_type))
  return {
    favorite: set.has('favorite'),
    recommend: set.has('recommend'),
  }
}

export async function getFileRecommendStats(
  fileId: string
): Promise<FilePreviewRecommendStats> {
  const db = getDb()

  const [countRow] = await db
    .select({ value: count() })
    .from(fileInteractions)
    .where(
      and(
        eq(fileInteractions.fileId, fileId),
        eq(fileInteractions.interactionType, 'recommend')
      )
    )

  const rows = await db
    .select({
      user_id: fileInteractions.userId,
      created_at: fileInteractions.createdAt,
    })
    .from(fileInteractions)
    .where(
      and(
        eq(fileInteractions.fileId, fileId),
        eq(fileInteractions.interactionType, 'recommend')
      )
    )
    .orderBy(desc(fileInteractions.createdAt))
    .limit(36)

  const seen = new Set<string>()
  const userIds: string[] = []
  for (const r of rows) {
    const uid = r.user_id
    if (!uid || seen.has(uid)) continue
    seen.add(uid)
    userIds.push(uid)
    if (userIds.length >= 6) break
  }

  if (userIds.length === 0) {
    return { count: countRow?.value ?? 0, sampleUsers: [] }
  }

  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      avatar_url: users.avatarUrl,
    })
    .from(users)
    .where(inArray(users.id, userIds))

  const orderMap = new Map(userIds.map((id, i) => [id, i]))
  const sampleUsers = userRows
    .slice()
    .sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
    )
    .map((u) => ({
      userId: u.id,
      name: u.name?.trim() || '用户',
      avatarUrl: resolveAvatarUrl(u.avatar_url) ?? null,
    }))

  return { count: countRow?.value ?? 0, sampleUsers }
}

export async function toggleFileInteractionForUser(
  userId: string,
  fileId: string,
  type: FileInteractionTypeValue
): Promise<{ favorite: boolean; recommend: boolean }> {
  const db = getDb()
  const removed = await db
    .delete(fileInteractions)
    .where(
      and(
        eq(fileInteractions.fileId, fileId),
        eq(fileInteractions.userId, userId),
        eq(fileInteractions.interactionType, type)
      )
    )
    .returning({ id: fileInteractions.id })

  if (!removed.length) {
    await db.insert(fileInteractions).values({
      fileId,
      userId,
      interactionType: type,
      userRoleAtTime: FILE_INTERACTION_USER_ROLE_AT_VIEWER,
    })
  }

  return getUserFileInteractionsForFile(userId, fileId)
}

/** 仅一级评论（parent_id 为空） */
export async function listTopLevelFileComments(
  fileId: string
): Promise<FilePreviewCommentRow[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: fileComments.id,
      content: fileComments.content,
      created_at: fileComments.createdAt,
      user_id: fileComments.userId,
      parent_id: fileComments.parentId,
    })
    .from(fileComments)
    .where(
      and(
        eq(fileComments.fileId, fileId),
        isNull(fileComments.deletedAt),
        isNull(fileComments.parentId)
      )
    )
    .orderBy(asc(fileComments.createdAt))
    .limit(TOP_LEVEL_COMMENT_LIMIT)

  const list = rows as CommentRowDb[]
  if (list.length === 0) return []

  const uids = [...new Set(list.map((r) => r.user_id))]
  const userMap = await fetchUserMap(uids)

  return list.map((r) => mapToPreviewRow(r, userMap, r.id, null))
}

/**
 * 某楼全部回复（不含顶层自身）：按 parent_id BFS 拉取子树，平铺后按时间排序。
 */
export async function listFileCommentThreadReplies(
  fileId: string,
  rootCommentId: string
): Promise<FilePreviewCommentRow[]> {
  const db = getDb()

  const rootRows = await db
    .select({
      id: fileComments.id,
      parent_id: fileComments.parentId,
    })
    .from(fileComments)
    .where(
      and(
        eq(fileComments.id, rootCommentId),
        eq(fileComments.fileId, fileId),
        isNull(fileComments.deletedAt)
      )
    )
    .limit(1)

  const root = rootRows[0]
  if (!root || root.parent_id != null) {
    throw new BusinessError('评论不存在或不是一级评论')
  }

  const collected: CommentRowDb[] = []
  let frontier: string[] = [rootCommentId]
  const seen = new Set<string>()

  while (frontier.length > 0 && collected.length < THREAD_REPLY_LIMIT) {
    const batch = await db
      .select({
        id: fileComments.id,
        content: fileComments.content,
        created_at: fileComments.createdAt,
        user_id: fileComments.userId,
        parent_id: fileComments.parentId,
      })
      .from(fileComments)
      .where(
        and(
          eq(fileComments.fileId, fileId),
          isNull(fileComments.deletedAt),
          inArray(fileComments.parentId, frontier)
        )
      )

    const part = batch as CommentRowDb[]
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
    toIsoString(a.created_at).localeCompare(toIsoString(b.created_at))
  )

  if (collected.length === 0) return []

  const uids = [...new Set(collected.map((r) => r.user_id))]
  const parentIds = [
    ...new Set(
      collected.map((r) => r.parent_id).filter((x): x is string => !!x)
    ),
  ]

  const parentRows = await db
    .select({
      id: fileComments.id,
      user_id: fileComments.userId,
    })
    .from(fileComments)
    .where(
      and(eq(fileComments.fileId, fileId), inArray(fileComments.id, parentIds))
    )

  const parentUidById = new Map(
    parentRows.map((p) => [p.id, p.user_id])
  )

  const allUids = [...new Set([...uids, ...parentUidById.values()])]
  const userMap = await fetchUserMap(allUids)

  return collected.map((r) => {
    const puid = r.parent_id ? parentUidById.get(r.parent_id) : null
    const parentAuthor = puid
      ? userMap.get(puid)?.name?.trim() || null
      : null
    return mapToPreviewRow(r, userMap, rootCommentId, parentAuthor)
  })
}

export async function insertFileCommentForPreview(
  userId: string,
  fileId: string,
  content: string,
  parentId: string | null
): Promise<FilePreviewCommentRow> {
  const db = getDb()

  let replyToUserName: string | null = null
  let rootCommentId: string | null = null

  if (parentId) {
    const parentRows = await db
      .select({
        id: fileComments.id,
        user_id: fileComments.userId,
        parent_id: fileComments.parentId,
      })
      .from(fileComments)
      .where(
        and(
          eq(fileComments.id, parentId),
          eq(fileComments.fileId, fileId),
          isNull(fileComments.deletedAt)
        )
      )
      .limit(1)

    const parent = parentRows[0]
    if (!parent) throw new BusinessError('回复的评论不存在或已删除')

    const pmap = await fetchUserMap([parent.user_id])
    replyToUserName = pmap.get(parent.user_id)?.name || '用户'
    rootCommentId = await resolveRootCommentId(fileId, parentId)
  }

  const id = randomUUID()
  if (!parentId) {
    rootCommentId = id
  }

  const inserted = await db
    .insert(fileComments)
    .values({
      id,
      fileId,
      userId,
      content,
      isPublic: true,
      ...(parentId ? { parentId } : {}),
    })
    .returning({
      id: fileComments.id,
      content: fileComments.content,
      created_at: fileComments.createdAt,
      parent_id: fileComments.parentId,
    })

  const row = inserted[0]
  if (!row) throw new BusinessError('写入评论失败')

  const rid = row.id
  const finalRoot: string = parentId ? (rootCommentId as string) : rid

  const userRows = await db
    .select({
      name: users.name,
      avatar_url: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const u = userRows[0]

  return {
    id: rid,
    parentId: row.parent_id ?? null,
    rootCommentId: finalRoot,
    content: row.content,
    createdAt: toIsoString(row.created_at),
    userName: u?.name?.trim() || '用户',
    userId,
    avatarUrl: resolveAvatarUrl(u?.avatar_url) ?? null,
    replyToUserName,
  }
}
