'use client'

import { Avatar, Button, Divider, Textarea } from '@heroui/react'
import { Icon } from '@iconify/react'
import { useCallback, useState } from 'react'
import {
  addFileCommentAction,
  loadFileCommentRepliesAction,
  toggleFileFavoriteAction,
  toggleFileRecommendAction,
} from '@/modules/files/social/actions'
import { formatUploadDateShort } from '@/modules/files/lib/format-upload-date'
import { showResultError } from '@/core/client/errors'
import type {
  FilePreviewCommentRow,
  FilePreviewLoadResult,
  FilePreviewRecommendStats,
} from '@/modules/files/types'

const MAX_DRAFT = 2000

type SocialPatch = Partial<
  Pick<FilePreviewLoadResult, 'interactions' | 'recommendStats'>
>

export interface FilePreviewInteractionPanelProps {
  fileId: string
  favorite: boolean
  recommend: boolean
  recommendStats: FilePreviewRecommendStats
  topLevelComments: FilePreviewCommentRow[]
  onSocialUpdate: (patch: SocialPatch) => void
  onTopLevelCommentAdded: (comment: FilePreviewCommentRow) => void
}

function CommentTime({ value }: { value: string }) {
  return (
    <time className="text-[11px] text-default-400">
      {formatUploadDateShort(value)}
    </time>
  )
}

function CommentAvatar({
  name,
  src,
  size = 'sm',
}: {
  name: string
  src: string | null
  size?: 'sm' | 'md'
}) {
  return (
    <Avatar
      className={size === 'md' ? 'size-9 shrink-0' : 'size-7 shrink-0'}
      radius="full"
      size={size}
      src={src ?? undefined}
      name={name}
      showFallback
    />
  )
}

export default function FilePreviewInteractionPanel({
  fileId,
  favorite,
  recommend,
  recommendStats,
  topLevelComments,
  onSocialUpdate,
  onTopLevelCommentAdded,
}: FilePreviewInteractionPanelProps) {
  const [pending, setPending] = useState<'favorite' | 'recommend' | null>(null)
  const [rootDraft, setRootDraft] = useState('')
  const [rootSubmitting, setRootSubmitting] = useState(false)
  const [expandedRootIds, setExpandedRootIds] = useState<Set<string>>(
    () => new Set()
  )
  const [threadByRoot, setThreadByRoot] = useState<
    Record<string, FilePreviewCommentRow[]>
  >({})
  const [threadLoadingId, setThreadLoadingId] = useState<string | null>(null)
  const [replyParentId, setReplyParentId] = useState<string | null>(null)
  const [replyRootId, setReplyRootId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)

  const runToggle = useCallback(
    async (kind: 'favorite' | 'recommend') => {
      setPending(kind)
      const res =
        kind === 'favorite'
          ? await toggleFileFavoriteAction(fileId)
          : await toggleFileRecommendAction(fileId)
      setPending(null)
      if (!res.success) {
        showResultError(res, '操作失败')
        return
      }
      onSocialUpdate({
        interactions: res.data.interactions,
        recommendStats: res.data.recommendStats,
      })
    },
    [fileId, onSocialUpdate]
  )

  const submitRoot = useCallback(async () => {
    const text = rootDraft.trim()
    if (!text || rootSubmitting) return
    setRootSubmitting(true)
    const res = await addFileCommentAction(fileId, text, null)
    setRootSubmitting(false)
    if (!res.success) {
      showResultError(res, '发送失败')
      return
    }
    onTopLevelCommentAdded(res.data)
    setRootDraft('')
  }, [fileId, onTopLevelCommentAdded, rootDraft, rootSubmitting])

  const submitReply = useCallback(async () => {
    const text = replyDraft.trim()
    if (!text || !replyParentId || replySubmitting) return
    setReplySubmitting(true)
    const res = await addFileCommentAction(fileId, text, replyParentId)
    setReplySubmitting(false)
    if (!res.success) {
      showResultError(res, '发送失败')
      return
    }
    const row = res.data
    setThreadByRoot((prev) => ({
      ...prev,
      [row.rootCommentId]: [...(prev[row.rootCommentId] ?? []), row],
    }))
    setExpandedRootIds((prev) => new Set(prev).add(row.rootCommentId))
    setReplyDraft('')
    setReplyParentId(null)
    setReplyRootId(null)
  }, [fileId, replyDraft, replyParentId, replySubmitting])

  const toggleThread = useCallback(
    async (rootId: string) => {
      if (expandedRootIds.has(rootId)) {
        setExpandedRootIds((prev) => {
          const next = new Set(prev)
          next.delete(rootId)
          return next
        })
        return
      }
      if (!(rootId in threadByRoot)) {
        setThreadLoadingId(rootId)
        const res = await loadFileCommentRepliesAction(fileId, rootId)
        setThreadLoadingId(null)
        if (!res.success) {
          showResultError(res, '加载失败')
          return
        }
        setThreadByRoot((prev) => ({ ...prev, [rootId]: res.data }))
      }
      setExpandedRootIds((prev) => new Set(prev).add(rootId))
    },
    [expandedRootIds, fileId, threadByRoot]
  )

  return (
    <div className="flex flex-col">
      <section className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-default-500">互动</p>
            <p className="mt-1 text-xs text-default-400">
              {recommendStats.count} 人推荐
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              isIconOnly
              size="sm"
              variant={recommend ? 'flat' : 'light'}
              color={recommend ? 'primary' : 'default'}
              aria-label={recommend ? '取消推荐' : '推荐'}
              isLoading={pending === 'recommend'}
              isDisabled={pending !== null}
              onPress={() => void runToggle('recommend')}
            >
              <Icon icon="lucide:thumbs-up" className="size-4" />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant={favorite ? 'flat' : 'light'}
              color={favorite ? 'warning' : 'default'}
              aria-label={favorite ? '取消收藏' : '收藏'}
              isLoading={pending === 'favorite'}
              isDisabled={pending !== null}
              onPress={() => void runToggle('favorite')}
            >
              <Icon
                icon={favorite ? 'lucide:star' : 'lucide:star'}
                className={favorite ? 'size-4 fill-current' : 'size-4'}
              />
            </Button>
          </div>
        </div>

        {recommendStats.sampleUsers.length > 0 ? (
          <div className="flex min-w-0 items-center -space-x-1.5 overflow-hidden ps-0.5 rtl:space-x-reverse">
            {recommendStats.sampleUsers.map((u) => (
              <Avatar
                key={u.userId}
                className="size-7 ring-2 ring-content1"
                radius="full"
                size="sm"
                src={u.avatarUrl ?? undefined}
                name={u.name}
              />
            ))}
          </div>
        ) : null}
      </section>

      <Divider />

      <section className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-default-500">评论</p>
          <span className="text-xs text-default-400">
            {topLevelComments.length}
          </span>
        </div>

        <Textarea
          minRows={2}
          maxRows={5}
          maxLength={MAX_DRAFT}
          size="sm"
          placeholder="写评论"
          value={rootDraft}
          onValueChange={setRootDraft}
          description={`${rootDraft.length}/${MAX_DRAFT}`}
        />
        <Button
          size="sm"
          color="primary"
          className="w-full"
          isLoading={rootSubmitting}
          isDisabled={!rootDraft.trim()}
          onPress={() => void submitRoot()}
        >
          发布评论
        </Button>
      </section>

      <Divider />

      <section className="p-4">
        {topLevelComments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-default-200 px-3 py-8 text-center">
            <p className="text-sm text-default-400">暂无评论</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {topLevelComments.map((comment) => {
              const open = expandedRootIds.has(comment.id)
              const thread = threadByRoot[comment.id]
              const loading = threadLoadingId === comment.id
              const replying = replyParentId && replyRootId === comment.id

              return (
                <li key={comment.id} className="space-y-3">
                  <div className="flex gap-2.5">
                    <CommentAvatar
                      name={comment.userName}
                      src={comment.avatarUrl}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-medium text-foreground">
                          {comment.userName}
                        </span>
                        <CommentTime value={comment.createdAt} />
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-default-700">
                        {comment.content}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          className="text-xs font-medium text-primary hover:underline"
                          onClick={() => {
                            setReplyParentId(comment.id)
                            setReplyRootId(comment.id)
                            setReplyDraft('')
                          }}
                        >
                          回复
                        </button>
                        <button
                          type="button"
                          className="text-xs text-default-500 hover:text-foreground"
                          onClick={() => void toggleThread(comment.id)}
                        >
                          {open ? '收起回复' : '展开回复'}
                          {loading ? '...' : ''}
                        </button>
                      </div>
                    </div>
                  </div>

                  {open && thread && thread.length > 0 ? (
                    <ul className="ms-11 space-y-3 border-s border-default-200 ps-3">
                      {thread.map((reply) => (
                        <li key={reply.id} className="flex gap-2">
                          <CommentAvatar
                            name={reply.userName}
                            src={reply.avatarUrl}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="text-sm font-medium text-foreground">
                                {reply.userName}
                              </span>
                              <CommentTime value={reply.createdAt} />
                            </div>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-default-700">
                              {reply.replyToUserName ? (
                                <span className="font-medium text-primary">
                                  @{reply.replyToUserName}{' '}
                                </span>
                              ) : null}
                              {reply.content}
                            </p>
                            <button
                              type="button"
                              className="mt-1 text-xs font-medium text-primary hover:underline"
                              onClick={() => {
                                setReplyParentId(reply.id)
                                setReplyRootId(comment.id)
                                setReplyDraft('')
                              }}
                            >
                              回复
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {open && thread && thread.length === 0 && !loading ? (
                    <p className="ms-11 text-xs text-default-400">暂无回复</p>
                  ) : null}

                  {replying ? (
                    <div className="ms-11 rounded-lg bg-default-100 p-3">
                      <Textarea
                        minRows={2}
                        maxRows={5}
                        maxLength={MAX_DRAFT}
                        size="sm"
                        placeholder="输入回复"
                        value={replyDraft}
                        onValueChange={setReplyDraft}
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="light"
                          onPress={() => {
                            setReplyParentId(null)
                            setReplyRootId(null)
                            setReplyDraft('')
                          }}
                        >
                          取消
                        </Button>
                        <Button
                          size="sm"
                          color="primary"
                          isLoading={replySubmitting}
                          isDisabled={!replyDraft.trim()}
                          onPress={() => void submitReply()}
                        >
                          发送
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
