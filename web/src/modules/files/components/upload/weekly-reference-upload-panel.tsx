'use client'

import { useRef, useState } from 'react'
import { Button, Progress, Tooltip, addToast } from '@heroui/react'
import { Icon } from '@iconify/react'
import {
  beginReferenceFileUploadAction,
  completeReferenceFileUploadAction,
} from '@/modules/files/upload/actions'
import { showErrorToast, showResultError } from '@/core/client/errors'
import { uploadFileToSignedUrl } from '@/modules/files/upload/direct-upload-client'
import type { FileSourceValue } from '@/modules/files/types'
import FileTypeIcon from '@/modules/files/components/upload/file-type-icon'
import FileUploadInteractionIcons from '@/modules/files/components/upload/file-upload-interaction-icons'
import {
  getProjectFileUploadAcceptAttribute,
  isAllowedProjectFileExtension,
  PROJECT_FILE_ALLOWED_EXT_HINT,
} from '@/core/storage/constants'
import { fileExtLower } from '@/modules/files/lib/safe-upload-filename'
import { formatFileSize } from '@/modules/files/lib/format-file-size'
import { randomClientId } from '@/core/random-client-id'

/** 参考资料来源（不含「原件」） */
type RefSource = Exclude<FileSourceValue, 'original'>

const REFERENCE_SOURCE_OPTIONS: { value: RefSource; label: string }[] = [
  { value: 'client', label: '客户资料' },
  { value: 'internal', label: '内部资料' },
  { value: 'public', label: '公开资料' },
]

/** 来源图标选择（Tooltip 显示完整名称） */
const SOURCE_ICON: Record<RefSource, string> = {
  client: 'lucide:users-round',
  internal: 'lucide:briefcase',
  public: 'lucide:globe',
}

const CONFIDENTIAL_TOOLTIP =
  '文件中有客户敏感信息。勾选后该文件无法被检索和 AI 应用，其他人员不可预览。'

const FILE_INPUT_ACCEPT = getProjectFileUploadAcceptAttribute()

export interface WeeklyReferenceUploadPanelProps {
  projectId: string
  optionsLoading: boolean
  onRefreshOptions: () => void
  /** 批量上传中每成功一个文件时回调（用于关联弹窗等场景自动勾选） */
  onEachUploadSuccess?: (fileId: string) => void
}

type QueueItem = {
  id: string
  file: File
  fileSource: RefSource
  isConfidential: boolean
  recommend: boolean
  favorite: boolean
}

export default function WeeklyReferenceUploadPanel({
  projectId,
  optionsLoading,
  onRefreshOptions,
  onEachUploadSuccess,
}: WeeklyReferenceUploadPanelProps) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStepLabel, setUploadStepLabel] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const updateItem = (
    id: string,
    patch: Partial<
      Pick<
        QueueItem,
        'isConfidential' | 'fileSource' | 'recommend' | 'favorite'
      >
    >
  ) => {
    setQueue((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    )
  }

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((it) => it.id !== id))
  }

  const onFilesPicked = (list: FileList | null) => {
    if (!list?.length) return
    const files = Array.from(list)
    const ok = files.filter((f) =>
      isAllowedProjectFileExtension(fileExtLower(f.name))
    )
    const bad = files.filter(
      (f) => !isAllowedProjectFileExtension(fileExtLower(f.name))
    )
    if (bad.length) {
      const names =
        bad.length <= 3
          ? bad.map((f) => f.name).join('、')
          : `${bad
              .slice(0, 3)
              .map((f) => f.name)
              .join('、')} 等 ${bad.length} 个`
      addToast({
        title: '已跳过不支持的文件',
        description: `${PROJECT_FILE_ALLOWED_EXT_HINT}：${names}`,
        color: 'warning',
      })
    }
    if (!ok.length) return
    const added: QueueItem[] = ok.map((file) => ({
      id: randomClientId(),
      file,
      fileSource: 'internal',
      isConfidential: false,
      recommend: false,
      favorite: false,
    }))
    setQueue((prev) => [...prev, ...added])
  }

  const submitAll = async () => {
    if (queue.length === 0) {
      addToast({ title: '请先添加待上传文件', color: 'warning' })
      return
    }

    const snapshot = [...queue]
    const total = snapshot.length
    setUploading(true)
    setUploadProgress(0)
    setUploadStepLabel(`0/${total}`)

    for (let i = 0; i < total; i++) {
      setUploadStepLabel(`${i + 1}/${total}`)
      setUploadProgress(Math.round((i / total) * 100))

      const item = snapshot[i]
      const begin = await beginReferenceFileUploadAction({
        projectId,
        fileName: item.file.name,
        fileSize: item.file.size,
        mimeType: item.file.type,
        fileSource: item.fileSource,
        isConfidential: item.isConfidential,
        recommend: item.recommend,
        favorite: item.favorite,
      })
      if (!begin.success) {
        showResultError(begin, `${item.file.name} 上传失败`)
        setQueue(snapshot.slice(i))
        setUploadProgress(Math.round((i / total) * 100))
        setUploading(false)
        setUploadStepLabel('')
        return
      }

      try {
        await uploadFileToSignedUrl({
          file: item.file,
          uploadUrl: begin.data.uploadUrl,
          onProgress: (percent) => {
            setUploadProgress(Math.round(((i + percent / 100) / total) * 100))
          },
        })
      } catch (e) {
        showErrorToast({
          title: `${item.file.name} 上传失败`,
          error: e,
        })
        setQueue(snapshot.slice(i))
        setUploadProgress(Math.round((i / total) * 100))
        setUploading(false)
        setUploadStepLabel('')
        return
      }

      const result = await completeReferenceFileUploadAction(
        begin.data.uploadToken
      )
      if (!result.success) {
        showResultError(result, `${item.file.name} 上传失败`)
        setQueue(snapshot.slice(i))
        setUploadProgress(Math.round((i / total) * 100))
        setUploading(false)
        setUploadStepLabel('')
        return
      }

      if (
        result.data &&
        typeof result.data === 'object' &&
        'id' in result.data
      ) {
        onEachUploadSuccess?.((result.data as { id: string }).id)
      }

      setUploadProgress(Math.round(((i + 1) / total) * 100))
    }

    setQueue([])
    setUploadProgress(100)
    setUploadStepLabel('')
    setUploading(false)
    addToast({ title: '已全部上传', color: 'success', timeout: 2200 })
    onRefreshOptions()
  }

  const busy = optionsLoading || uploading

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept={FILE_INPUT_ACCEPT}
          disabled={busy}
          onChange={(e) => {
            onFilesPicked(e.target.files)
            e.target.value = ''
          }}
        />
        <Button
          variant="flat"
          color="secondary"
          isDisabled={busy}
          startContent={<Icon icon="lucide:files" className="size-5" />}
          onPress={() => inputRef.current?.click()}
        >
          选择文件（可多选）
        </Button>
      </div>

      {uploading ? (
        <div className="space-y-1 rounded-lg border border-default-200 bg-default-50/50 p-3">
          <Progress
            aria-label="上传进度"
            size="sm"
            value={uploadProgress}
            color="secondary"
            className="max-w-full"
          />
          <p className="text-xs text-default-500">
            正在上传 {uploadStepLabel}
          </p>
        </div>
      ) : null}

      {queue.length === 0 ? (
        <p className="rounded-lg border border-dashed border-default-200 bg-default-50/50 px-4 py-8 text-center text-sm text-default-500">
          暂无待上传文件
        </p>
      ) : (
        <div className="space-y-2">
          <ul className="divide-y divide-default-200 rounded-lg border border-default-200/90 bg-content1">
            {queue.map((item) => (
              <li
                key={item.id}
                className="flex flex-nowrap items-center gap-2 px-3 py-2.5 text-sm max-md:flex-wrap"
              >
                <div className="flex min-w-0 flex-1 max-md:basis-full items-start gap-2">
                  <FileTypeIcon
                    fileName={item.file.name}
                    className="mt-0.5 size-5 shrink-0 object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate font-medium text-foreground"
                      title={item.file.name}
                    >
                      {item.file.name}
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums text-default-400">
                      {formatFileSize(item.file.size)}
                    </p>
                  </div>
                </div>

                <div
                  className="inline-flex shrink-0 items-center rounded-medium border border-default-200 bg-default-100/40 p-0.5"
                  role="group"
                  aria-label={`${item.file.name} 的文件来源`}
                >
                  {REFERENCE_SOURCE_OPTIONS.map((opt) => (
                    <Tooltip
                      key={opt.value}
                      content={opt.label}
                      placement="top"
                      delay={200}
                    >
                      <Button
                        isIconOnly
                        size="sm"
                        variant={
                          item.fileSource === opt.value ? 'flat' : 'light'
                        }
                        color={
                          item.fileSource === opt.value ? 'primary' : 'default'
                        }
                        className="min-w-8"
                        isDisabled={busy}
                        aria-label={opt.label}
                        aria-pressed={item.fileSource === opt.value}
                        onPress={() =>
                          updateItem(item.id, { fileSource: opt.value })
                        }
                      >
                        <Icon
                          icon={SOURCE_ICON[opt.value]}
                          className="size-4"
                          aria-hidden
                        />
                      </Button>
                    </Tooltip>
                  ))}
                </div>

                <Tooltip
                  content={CONFIDENTIAL_TOOLTIP}
                  placement="top"
                  delay={200}
                  classNames={{ content: 'max-w-xs' }}
                >
                  <Button
                    isIconOnly
                    size="sm"
                    variant={item.isConfidential ? 'flat' : 'light'}
                    color={item.isConfidential ? 'warning' : 'default'}
                    className="shrink-0"
                    isDisabled={busy}
                    aria-pressed={item.isConfidential}
                    aria-label="客户敏感信息"
                    onPress={() =>
                      updateItem(item.id, {
                        isConfidential: !item.isConfidential,
                      })
                    }
                  >
                    <Icon
                      icon={
                        item.isConfidential
                          ? 'lucide:shield-alert'
                          : 'lucide:shield-off'
                      }
                      className="size-4"
                    />
                  </Button>
                </Tooltip>

                <FileUploadInteractionIcons
                  recommend={item.recommend}
                  favorite={item.favorite}
                  disabled={busy}
                  onToggleRecommend={() =>
                    updateItem(item.id, { recommend: !item.recommend })
                  }
                  onToggleFavorite={() =>
                    updateItem(item.id, { favorite: !item.favorite })
                  }
                />

                <Button
                  size="sm"
                  variant="light"
                  color="danger"
                  isIconOnly
                  className="ml-3 shrink-0"
                  aria-label="从列表移除"
                  isDisabled={busy}
                  onPress={() => removeItem(item.id)}
                >
                  <Icon
                    icon="lucide:trash-2"
                    className="size-[18px]"
                    aria-hidden
                  />
                </Button>
              </li>
            ))}
          </ul>

          <Button
            color="secondary"
            className="w-full sm:w-auto"
            isLoading={uploading}
            isDisabled={busy || queue.length === 0}
            onPress={() => void submitAll()}
          >
            上传文件
          </Button>
        </div>
      )}
    </div>
  )
}
