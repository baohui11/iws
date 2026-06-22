'use client'

import { Avatar, Button, Divider, Textarea, addToast } from '@heroui/react'
import { Icon } from '@iconify/react'
import { useCallback, useState } from 'react'
import {
  addFileCommentAction,
  loadFileCommentRepliesAction,
  toggleFileFavoriteAction,
  toggleFileRecommendAction,
} from '@/actions/files/file-preview-social.action'
import { formatUploadDateShort } from '@/lib/utils/format-upload-date'
import type {
  FilePreviewCommentRow,
  FilePreviewLoadResult,
  FilePreviewRecommendStats,
} from '@/types/file-preview'

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

function formatCommentTime(iso: string) {
  if (!iso) return ''
  return formatUploadDateShort(iso)
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
  const [pending, setPending] = useState<'favorite' | 'recommend' | null>(
    null
  )
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
      if (res.success && res.data) {
        onSocialUpdate({
          interactions: res.data.interactions,
          recommendStats: res.data.recommendStats,
        })
        return
      }
      addToast({
        title: '操作失败',
        description: res.message ?? '请稍后重试',
        color: 'danger',
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
    if (res.success && res.data) {
      onTopLevelCommentAdded(res.data)
      setRootDraft('')
      return
    }
    addToast({
      title: '发送失败',
      description: res.message ?? '请稍后重试',
      color: 'danger',
    })
  }, [fileId, onTopLevelCommentAdded, rootDraft, rootSubmitting])

  const submitReply = useCallback(async () => {
    const text = replyDraft.trim()
    if (!text || !replyParentId || replySubmitting) return
    setReplySubmitting(true)
    const res = await addFileCommentAction(fileId, text, replyParentId)
    setReplySubmitting(false)
    if (res.success && res.data) {
      const row = res.data
      const root = row.rootCommentId
      setThreadByRoot((prev) => ({
        ...prev,
        [root]: [...(prev[root] ?? []), row],
      }))
      setExpandedRootIds((e) => new Set(e).add(root))
      setReplyDraft('')
      setReplyParentId(null)
      setReplyRootId(null)
      return
    }
    addToast({
      title: '发送失败',
      description: res.message ?? '请稍后重试',
      color: 'danger',
    })
  }, [fileId, replyDraft, replyParentId, replySubmitting])

  const toggleThread = useCallback(
    async (rootId: string) => {
      if (expandedRootIds.has(rootId)) {
        setExpandedRootIds((prev) => {
          const n = new Set(prev)
          n.delete(rootId)
          return n
        })
        return
      }
      if (!(rootId in threadByRoot)) {
        setThreadLoadingId(rootId)
        const res = await loadFileCommentRepliesAction(fileId, rootId)
        setThreadLoadingId(null)
        if (res.success && res.data) {
          const rows = res.data
          setThreadByRoot((p) => ({ ...p, [rootId]: rows }))
        } else {
          addToast({
            title: '加载失败',
            description: res.message ?? '请稍后重试',
            color: 'danger',
          })
          return
        }
      }
      setExpandedRootIds((prev) => new Set(prev).add(rootId))
    },
    [expandedRootIds, fileId, threadByRoot]
  )

  const startReply = useCallback((parentId: string, rootId: string) => {
    setReplyParentId(parentId)
    setReplyRootId(rootId)
    setReplyDraft('')
  }, [])

  const cancelReply = useCallback(() => {
    setReplyParentId(null)
    setReplyRootId(null)
    setReplyDraft('')
  }, [])

  return (
    <div className="flex flex-col bg-transparent">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label={recommend ? '取消推荐' : '推荐'}
            className={recommend ? 'text-primary-600' : 'text-default-500'}
            isLoading={pending === 'recommend'}
            isDisabled={pending !== null}
            onPress={() => void runToggle('recommend')}
          >
            <Icon icon="lucide:thumbs-up" className="size-5" />
          </Button>
          <span className="text-xs tabular-nums text-default-600">
            {recommendStats.count}
          </span>
          <div className="flex min-w-0 flex-1 items-center -space-x-1.5 overflow-hidden ps-0.5 rtl:space-x-reverse">
            {recommendStats.sampleUsers.length > 0 ? (
              recommendStats.sampleUsers.map((u) => (
                <Avatar
                  key={u.userId}
                  className="size-7 ring-2 ring-content1"
                  radius="full"
                  size="sm"
                  src={u.avatarUrl ?? undefined}
                  name={u.name}
                />
              ))
            ) : (
              <span className="text-[11px] text-default-400">—</span>
            )}
          </div>
        </div>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          aria-label={favorite ? '已收藏' : '收藏'}
          className={favorite ? 'text-warning-500' : 'text-default-400'}
          isLoading={pending === 'favorite'}
          isDisabled={pending !== null}
          onPress={() => void runToggle('favorite')}
        >
          <Icon
            icon={favorite ? 'mdi:star' : 'mdi:star-outline'}
            className="size-6"
          />
        </Button>
      </div>

      <Divider />

      <div className="px-4 py-3">
        <p className="mb-3 text-xs text-default-500">评论</p>
        {topLevelComments.length === 0 ? (
          <p className="py-6 text-center text-sm text-default-400">
            还没有评论
          </p>
        ) : (
          <ul className="space-y-4">
            {topLevelComments.map((c) => {
              const open = expandedRootIds.has(c.id)
              const thread = threadByRoot[c.id]
              const loading = threadLoadingId === c.id

              return (
                <li key={c.id} className="border-b border-default-100 pb-4 last:border-0">
                  <div className="flex gap-3">
                    <Avatar
                      className="size-10 shrink-0"
                      radius="full"
                      size="md"
                      src={c.avatarUrl ?? undefined}
                      name={c.userName}
                      showFallback
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-foreground">
                          {c.userName}
                        </span>
                        <time className="text-[11px] text-default-400">
                          {formatCommentTime(c.createdAt)}
                        </time>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-default-800">
                        {c.content}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          className="text-xs font-medium text-primary-600 hover:underline"
                          onClick={() => startReply(c.id, c.id)}
                        >
                          回复
                        </button>
                        <button
                          type="button"
                          className="text-xs text-default-500 hover:text-foreground"
                          onClick={() => void toggleThread(c.id)}
                        >
                          {open ? '收起回复' : '展开回复'}
                          {loading ? '…' : null}
                        </button>
                      </div>

                      {open && thread && thread.length > 0 ? (
                        <ul className="mt-3 space-y-3 border-t border-default-100 pt-3">
                          {thread.map((r) => (
                            <li key={r.id} className="flex gap-2.5">
                              <Avatar
                                className="size-8 shrink-0"
                                radius="full"
                                size="sm"
                                src={r.avatarUrl ?? undefined}
                                name={r.userName}
                                showFallback
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2">
                                  <span className="text-sm font-medium text-foreground">
                                    {r.userName}
                                  </span>
                                  <time className="text-[11px] text-default-400">
                                    {formatCommentTime(r.createdAt)}
                                  </time>
                                </div>
                                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-default-700">
                                  {r.replyToUserName ? (
                                    <span className="font-medium text-primary-600">
                                      @{r.replyToUserName}{' '}
                                    </span>
                                  ) : null}
                                  {r.content}
                                </p>
                                <button
                                  type="button"
                                  className="mt-1.5 text-xs font-medium text-primary-600 hover:underline"
                                  onClick={() => startReply(r.id, c.id)}
                                >
                                  回复
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {open && thread && thread.length === 0 && !loading ? (
                        <p className="mt-2 text-xs text-default-400">
                          暂无回复
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {replyParentId && replyRootId === c.id ? (
                    <div className="mt-3 rounded-lg bg-default-100/80 p-3">
                      <Textarea
                        minRows={2}
                        maxRows={5}
                        maxLength={MAX_DRAFT}
                        size="sm"
                        placeholder="输入回复…"
                        value={replyDraft}
                        onValueChange={setReplyDraft}
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="light"
                          onPress={cancelReply}
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
      </div>

      <div className="border-t border-default-100 px-4 pb-4 pt-2">
        <Textarea
          minRows={2}
          maxRows={4}
          maxLength={MAX_DRAFT}
          size="sm"
          placeholder="写评论…"
          value={rootDraft}
          onValueChange={setRootDraft}
          description={`${rootDraft.length}/${MAX_DRAFT}`}
        />
        <Button
          className="mt-2"
          size="sm"
          color="primary"
          isLoading={rootSubmitting}
          isDisabled={!rootDraft.trim()}
          onPress={() => void submitRoot()}
        >
          发布
        </Button>
      </div>
    </div>
  )
}
