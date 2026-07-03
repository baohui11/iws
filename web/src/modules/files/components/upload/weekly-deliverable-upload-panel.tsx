'use client'

import { useRef, useState } from 'react'
import {
  Button,
  Input,
  Progress,
  Select,
  SelectItem,
  Tooltip,
  addToast,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import {
  beginDeliverableFileUploadAction,
  completeDeliverableFileUploadAction,
} from '@/modules/files/upload/actions'
import { showErrorToast, showResultError } from '@/core/client/errors'
import { uploadFileToSignedUrl } from '@/modules/files/upload/direct-upload-client'
import DeliverableReferencePickerModal from '@/modules/files/components/upload/deliverable-reference-picker-modal'
import FileTypeIcon from '@/modules/files/components/upload/file-type-icon'
import FileUploadInteractionIcons from '@/modules/files/components/upload/file-upload-interaction-icons'
import {
  getProjectFileUploadAcceptAttribute,
  isAllowedProjectFileExtension,
  PROJECT_FILE_ALLOWED_EXT_HINT,
} from '@/core/storage/constants'
import {
  DELIVERABLE_FILENAME_RULE_HINT,
  getDeliverableLogicalBaseFromStoredName,
  parseDeliverableFilename,
} from '@/modules/files/lib/deliverable-filename'
import { formatFileSize } from '@/modules/files/lib/format-file-size'
import { randomClientId } from '@/core/random-client-id'
import { groupReferenceFilesByOrderedSource } from '@/modules/files/lib/reference-file-source'
import { fileExtLower, getBasenameOnly } from '@/modules/files/lib/safe-upload-filename'
import type {
  ContractDeliverableOption,
  ExistingDeliverableFileOption,
  ReferenceFileOption,
} from '@/modules/files/types'

const FILE_INPUT_ACCEPT = getProjectFileUploadAcceptAttribute()

const CONFIDENTIAL_TOOLTIP =
  '文件中有客户敏感信息。勾选后该文件无法被检索和 AI 应用，其他人员不可预览。'

export interface WeeklyDeliverableUploadPanelProps {
  projectId: string
  deliverables: ContractDeliverableOption[]
  existingDeliverableFiles: ExistingDeliverableFileOption[]
  referenceFiles: ReferenceFileOption[]
  optionsLoading: boolean
  onRefreshOptions: () => void
}

type QueueItem = {
  id: string
  file: File
  parsed: ReturnType<typeof parseDeliverableFilename> | null
  parseError: string | null
  /** 成果版本号，可手改；默认识别自文件名 `-V主.次` */
  versionLabelInput: string
  /** 合同成果：仅选合同清单项，版本组由服务端按合同项自动处理 */
  isContractDeliverable: boolean
  contractDeliverableId: string
  /** 非合同成果：关联项目中已有非合同成果的最新版，续写该版本组 */
  existingDeliverableFileId: string
  referenceFileIds: Set<string>
  isConfidential: boolean
  recommend: boolean
  favorite: boolean
}

function logicalNameMismatchMessage(
  item: QueueItem,
  deliverables: ContractDeliverableOption[],
  existingDeliverableFiles: ExistingDeliverableFileOption[]
): string | null {
  if (!item.parsed) return null
  const logical = item.parsed.baseName.trim()
  if (item.isContractDeliverable && item.contractDeliverableId) {
    const d = deliverables.find((x) => x.id === item.contractDeliverableId)
    if (d && logical !== d.name.trim()) {
      return `逻辑名须与合同成果项名称一致（合同项为「${d.name.trim()}」，当前文件为「${logical}」）`
    }
  }
  if (!item.isContractDeliverable && item.existingDeliverableFileId) {
    const f = existingDeliverableFiles.find(
      (x) => x.id === item.existingDeliverableFileId
    )
    if (f) {
      const linked = getDeliverableLogicalBaseFromStoredName(f.file_name)
      if (linked && logical !== linked) {
        return `逻辑名须与所关联成果一致（期望「${linked}」，当前为「${logical}」）`
      }
    }
  }
  return null
}

function newQueueItemFromFile(file: File): QueueItem {
  const base = getBasenameOnly(file.name)
  const parsed = parseDeliverableFilename(base)
  return {
    id: randomClientId(),
    file,
    parsed,
    parseError: parsed ? null : DELIVERABLE_FILENAME_RULE_HINT,
    versionLabelInput: parsed?.versionLabel ?? '',
    isContractDeliverable: true,
    contractDeliverableId: '',
    existingDeliverableFileId: '',
    referenceFileIds: new Set(),
    isConfidential: false,
    recommend: false,
    favorite: false,
  }
}

export default function WeeklyDeliverableUploadPanel({
  projectId,
  deliverables,
  existingDeliverableFiles,
  referenceFiles,
  optionsLoading,
  onRefreshOptions,
}: WeeklyDeliverableUploadPanelProps) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [refModalItemId, setRefModalItemId] = useState<string | null>(null)
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const updateItem = (id: string, patch: Partial<QueueItem>) => {
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
    setQueue((prev) => [...prev, ...ok.map(newQueueItemFromFile)])
  }

  const standaloneLatestDeliverables = existingDeliverableFiles.filter(
    (f) => f.contract_deliverable_id === null
  )

  const submitOne = async (item: QueueItem) => {
    if (!item.parsed) {
      showErrorToast({
        title: '文件名不符合规则',
        message: item.parseError ?? DELIVERABLE_FILENAME_RULE_HINT,
      })
      return
    }
    const linkErr = logicalNameMismatchMessage(
      item,
      deliverables,
      existingDeliverableFiles
    )
    if (linkErr) {
      showErrorToast({ title: '逻辑名不一致', message: linkErr })
      return
    }
    setUploadingItemId(item.id)
    setUploadProgress(0)
    try {
      const begin = await beginDeliverableFileUploadAction({
        projectId,
        fileName: item.file.name,
        fileSize: item.file.size,
        mimeType: item.file.type,
        deliverableMode: item.isContractDeliverable ? 'contract' : 'standalone',
        contractDeliverableId: item.contractDeliverableId,
        existingDeliverableFileId: item.existingDeliverableFileId,
        referenceFileIds: [...item.referenceFileIds],
        versionLabel: item.versionLabelInput,
        isConfidential: item.isConfidential,
        recommend: item.recommend,
        favorite: item.favorite,
      })
      if (!begin.success) {
        showResultError(begin, `${item.file.name} 提交失败`)
        return
      }

      await uploadFileToSignedUrl({
        file: item.file,
        uploadUrl: begin.data.uploadUrl,
        onProgress: setUploadProgress,
      })

      const result = await completeDeliverableFileUploadAction(
        begin.data.uploadToken
      )
      if (result.success) {
        addToast({ title: '已提交', color: 'success', timeout: 2200 })
        removeItem(item.id)
        onRefreshOptions()
      } else {
        showResultError(result, `${item.file.name} 提交失败`)
      }
    } catch (e) {
      showErrorToast({ title: `${item.file.name} 提交失败`, error: e })
    } finally {
      setUploadingItemId(null)
      setUploadProgress(0)
    }
  }

  const busy = uploadingItemId !== null || optionsLoading

  const resolveSelectedReferenceRows = (ids: Set<string>) => {
    return [...ids].map((id) => {
      const r = referenceFiles.find((x) => x.id === id)
      return (
        r ?? {
          id,
          file_name: '（参考资料）',
          file_source: 'unknown',
          created_at: '',
        }
      )
    })
  }

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
          color="primary"
          isDisabled={busy}
          startContent={<Icon icon="lucide:file-up" className="size-5" />}
          onPress={() => inputRef.current?.click()}
        >
          选择文件
        </Button>
      </div>

      {queue.length === 0 ? (
        <p className="rounded-lg border border-dashed border-default-200 bg-default-50/50 px-4 py-8 text-center text-sm text-default-500">
          暂无待提交文件，请使用上方按钮选择
        </p>
      ) : (
        <ul className="space-y-4">
          {queue.map((item) => {
            const standaloneItems = standaloneLatestDeliverables.map((f) => ({
              key: f.id,
              file_name: f.file_name,
            }))
            const linkMismatch = logicalNameMismatchMessage(
              item,
              deliverables,
              existingDeliverableFiles
            )
            return (
              <li
                key={item.id}
                className="rounded-xl border border-default-200/90 bg-content1 p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-start gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
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
                  <div className="flex shrink-0 flex-col gap-0.5">
                    {/* <span className="text-xs text-default-500">版本号</span> */}
                    <Input
                      size="sm"
                      label="版本号:"
                      labelPlacement="outside-left"
                      variant="underlined"
                      aria-label="成果版本号"
                      placeholder="如 V1.0"
                      value={item.versionLabelInput}
                      onValueChange={(v) =>
                        updateItem(item.id, { versionLabelInput: v })
                      }
                      isDisabled={busy}
                      classNames={{
                        input: 'text-sm tabular-nums text-primary',
                        label: 'text-sm',
                        inputWrapper: 'h-9 min-w-[6.5rem] max-w-[7.5rem]',
                      }}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="light"
                    color="danger"
                    isIconOnly
                    className="shrink-0 self-start"
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
                </div>

                {item.parsed ? (
                  <p className="mb-2 text-xs text-default-500">
                    已识别：逻辑名「{item.parsed.baseName}」、版本 {item.parsed.versionLabel}、日期{' '}
                    {item.parsed.dateYyyymmdd}、后缀 .{item.parsed.ext}
                  </p>
                ) : (
                  <p className="mb-2 text-xs text-danger">
                    {item.parseError ?? DELIVERABLE_FILENAME_RULE_HINT}
                  </p>
                )}
                {item.parsed && linkMismatch ? (
                  <p className="mb-2 text-xs text-danger">{linkMismatch}</p>
                ) : null}
                {uploadingItemId === item.id ? (
                  <div className="mb-3 space-y-1 rounded-lg border border-default-200 bg-default-50/50 p-3">
                    <Progress
                      aria-label="上传进度"
                      size="sm"
                      value={uploadProgress}
                      color="primary"
                    />
                    <p className="text-xs text-default-500">
                      正在上传 {uploadProgress}%
                    </p>
                  </div>
                ) : null}

                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    关联成果文件
                  </p>
                  <p className="text-xs text-default-500">
                    可不选。不选则作为本条成果的首个版本。
                  </p>
                  <div className="rounded-lg border border-default-200/80 bg-default-50/30 p-3">
                    <p className="mb-2 text-xs font-medium text-default-600">
                      成果类型
                    </p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={
                          item.isContractDeliverable ? 'flat' : 'bordered'
                        }
                        color={
                          item.isContractDeliverable ? 'primary' : 'default'
                        }
                        className="min-w-0"
                        isDisabled={busy}
                        onPress={() =>
                          updateItem(item.id, {
                            isContractDeliverable: true,
                            existingDeliverableFileId: '',
                          })
                        }
                      >
                        合同成果
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          !item.isContractDeliverable ? 'flat' : 'bordered'
                        }
                        color={
                          !item.isContractDeliverable ? 'primary' : 'default'
                        }
                        className="min-w-0"
                        isDisabled={busy}
                        onPress={() =>
                          updateItem(item.id, {
                            isContractDeliverable: false,
                            contractDeliverableId: '',
                          })
                        }
                      >
                        非合同成果
                      </Button>
                    </div>

                    {item.isContractDeliverable ? (
                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-medium text-default-600">
                          关联合同成果文件
                        </p>
                        <Select
                          label=""
                          aria-label="关联合同成果文件"
                          placeholder="选择合同成果项"
                          variant="bordered"
                          items={deliverables.map((d) => ({
                            key: d.id,
                            label: d.name,
                            description: d.description,
                          }))}
                          selectedKeys={
                            item.contractDeliverableId
                              ? new Set([item.contractDeliverableId])
                              : new Set()
                          }
                          onSelectionChange={(keys) => {
                            const k = [...keys][0] as string | undefined
                            updateItem(item.id, {
                              contractDeliverableId: k ?? '',
                            })
                          }}
                          isDisabled={busy}
                          classNames={{
                            label: 'hidden',
                            trigger: 'h-10 min-h-10',
                            base: 'w-full',
                          }}
                        >
                          {(row) => (
                            <SelectItem key={row.key} textValue={row.label}>
                              <div className="flex min-w-0 items-center gap-2">
                                <FileTypeIcon
                                  fileName={row.label}
                                  className="size-5 shrink-0 object-contain"
                                />
                                <span
                                  className="min-w-0 truncate font-medium text-foreground"
                                  title={
                                    row.description
                                      ? `${row.label} · ${row.description}`
                                      : row.label
                                  }
                                >
                                  {row.label}
                                </span>
                              </div>
                            </SelectItem>
                          )}
                        </Select>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <p className="mb-1 text-xs font-medium text-default-600">
                          关联非合同成果（最新版）
                        </p>
                        {standaloneItems.length === 0 ? (
                          <p className="text-xs text-default-500">
                            项目中暂无非合同成果；可直接提交，将作为新成果首个版本。
                          </p>
                        ) : (
                          <Select
                            label=""
                            aria-label="关联非合同成果最新版"
                            placeholder="可选：续写某版本组"
                            variant="bordered"
                            items={standaloneItems}
                            selectedKeys={
                              item.existingDeliverableFileId
                                ? new Set([item.existingDeliverableFileId])
                                : new Set()
                            }
                            onSelectionChange={(keys) => {
                              const k = [...keys][0] as string | undefined
                              updateItem(item.id, {
                                existingDeliverableFileId: k ?? '',
                              })
                            }}
                            isDisabled={busy}
                            classNames={{
                              label: 'hidden',
                              trigger: 'h-10 min-h-10',
                              base: 'w-full',
                            }}
                          >
                            {(row) => (
                              <SelectItem
                                key={row.key}
                                textValue={row.file_name}
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <FileTypeIcon
                                    fileName={row.file_name}
                                    className="size-5 shrink-0 object-contain"
                                  />
                                  <span
                                    className="min-w-0 truncate font-medium text-foreground"
                                    title={row.file_name}
                                  >
                                    {row.file_name}
                                  </span>
                                </div>
                              </SelectItem>
                            )}
                          </Select>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    关联参考资料
                  </p>
                  <Button
                    variant="bordered"
                    size="sm"
                    className="w-full justify-start sm:w-auto"
                    isDisabled={busy}
                    startContent={
                      <Icon icon="lucide:book-marked" className="size-4" />
                    }
                    onPress={() => setRefModalItemId(item.id)}
                  >
                    选择参考资料
                  </Button>
                  {item.referenceFileIds.size > 0 ? (
                    <div className="space-y-3 rounded-lg border border-default-200/90 bg-content1 p-3">
                      {groupReferenceFilesByOrderedSource(
                        resolveSelectedReferenceRows(item.referenceFileIds)
                      ).map((g) => (
                        <div key={g.key} className="space-y-1.5">
                          <p className="text-xs font-semibold text-default-600">
                            {g.label}
                          </p>
                          <ul className="space-y-1.5">
                            {g.items.map((r) => (
                              <li
                                key={r.id}
                                className="flex min-w-0 items-center gap-2 text-sm"
                              >
                                <FileTypeIcon
                                  fileName={r.file_name}
                                  className="size-4 shrink-0 object-contain"
                                />
                                <span
                                  className="min-w-0 truncate text-default-700"
                                  title={r.file_name}
                                >
                                  {r.file_name}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-default-500">
                      未选择参考资料（可选）
                    </p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
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
                    color="primary"
                    size="sm"
                    isLoading={busy}
                    isDisabled={busy || !item.parsed || !!linkMismatch}
                    onPress={() => void submitOne(item)}
                  >
                    提交此文件
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <DeliverableReferencePickerModal
        isOpen={refModalItemId !== null}
        onClose={() => setRefModalItemId(null)}
        onConfirm={(ids) => {
          if (refModalItemId) {
            updateItem(refModalItemId, {
              referenceFileIds: new Set(ids),
            })
          }
        }}
        initialSelectedIds={
          refModalItemId
            ? [
                ...(queue.find((i) => i.id === refModalItemId)
                  ?.referenceFileIds ?? []),
              ]
            : []
        }
        referenceFiles={referenceFiles}
        projectId={projectId}
        onRefreshOptions={onRefreshOptions}
      />
    </div>
  )
}
