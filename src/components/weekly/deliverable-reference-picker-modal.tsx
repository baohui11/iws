'use client'

import { useEffect, useState } from 'react'
import {
  Button,
  Checkbox,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import FileTypeIcon from '@/components/weekly/file-type-icon'
import WeeklyReferenceUploadPanel from '@/components/weekly/weekly-reference-upload-panel'
import { groupReferenceFilesByOrderedSource } from '@/lib/utils/reference-file-source'
import { formatUploadDateShort } from '@/lib/utils/format-upload-date'
import { truncateFilenameMiddle } from '@/lib/utils/truncate-filename-middle'
import type { ReferenceFileOption } from '@/types/file-upload'

export interface DeliverableReferencePickerModalProps {
  isOpen: boolean
  onClose: () => void
  /** 确认后回传当前选中的文件 id 列表 */
  onConfirm: (fileIds: string[]) => void
  initialSelectedIds: string[]
  /** 项目内参考资料（已按上传时间倒序） */
  referenceFiles: ReferenceFileOption[]
  projectId: string
  onRefreshOptions: () => void
}

export default function DeliverableReferencePickerModal({
  isOpen,
  onClose,
  onConfirm,
  initialSelectedIds,
  referenceFiles,
  projectId,
  onRefreshOptions,
}: DeliverableReferencePickerModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [uploadSubOpen, setUploadSubOpen] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(initialSelectedIds))
    }
  }, [isOpen, initialSelectedIds])

  const toggleId = (id: string, on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const removeSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const metaForId = (id: string): ReferenceFileOption =>
    referenceFiles.find((r) => r.id === id) ?? {
      id,
      file_name: '（参考资料）',
      file_source: 'unknown',
      created_at: '',
    }

  const handleConfirm = () => {
    onConfirm([...selectedIds])
    onClose()
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="2xl"
        scrollBehavior="inside"
        placement="center"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 border-b border-default-200 px-6 py-4">
            <span className="text-lg font-semibold">关联参考资料</span>
            <span className="text-xs font-normal text-default-500">
              项目内参考资料按上传时间从新到旧排列；可勾选或新增上传后加入已选。
            </span>
          </ModalHeader>
          <ModalBody className="gap-6 px-6 py-4">
            <section className="space-y-2">
              <p className="text-sm font-medium text-foreground">已选文件</p>
              {selectedIds.size === 0 ? (
                <p className="rounded-lg border border-dashed border-default-200 bg-default-50/50 px-3 py-6 text-center text-sm text-default-500">
                  尚未选择
                </p>
              ) : (
                <div className="max-h-52 space-y-3 overflow-y-auto rounded-lg border border-default-200 p-2">
                  {groupReferenceFilesByOrderedSource(
                    [...selectedIds].map((id) => metaForId(id))
                  ).map((g) => (
                    <div key={g.key} className="space-y-1">
                      <p className="text-xs font-semibold text-default-600">
                        {g.label}
                      </p>
                      <ul className="space-y-0.5">
                        {g.items.map((r) => (
                          <li
                            key={r.id}
                            className="flex w-full items-center gap-2 py-1 pr-0.5 text-sm"
                          >
                            <FileTypeIcon
                              fileName={r.file_name}
                              className="size-5 shrink-0 object-contain"
                            />
                            <span
                              className="min-w-0 flex-1 text-sm text-foreground"
                              title={r.file_name}
                            >
                              {truncateFilenameMiddle(r.file_name)}
                            </span>
                            <span className="shrink-0 text-[11px] tabular-nums text-default-400">
                              {formatUploadDateShort(r.created_at)}
                            </span>
                            <Button
                              size="sm"
                              variant="light"
                              color="danger"
                              isIconOnly
                              className="shrink-0"
                              aria-label="从列表移除"
                              onPress={() => removeSelected(r.id)}
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
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  已上传的参考资料
                </p>
                <Button
                  size="sm"
                  variant="flat"
                  color="secondary"
                  className="h-7 min-h-7 shrink-0 px-2 text-xs"
                  startContent={
                    <Icon icon="lucide:upload" className="size-3.5" />
                  }
                  onPress={() => setUploadSubOpen(true)}
                >
                  新增
                </Button>
              </div>
              {referenceFiles.length === 0 ? (
                <p className="text-sm text-default-500">暂无参考资料</p>
              ) : (
                <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-default-200 p-2">
                  {groupReferenceFilesByOrderedSource(referenceFiles).map(
                    (g) => (
                      <div key={g.key} className="space-y-1.5">
                        <p className="text-xs font-semibold text-default-600">
                          {g.label}
                        </p>
                        <ul className="divide-y divide-default-100">
                          {g.items.map((r) => (
                            <li key={r.id} className="py-2 first:pt-0">
                              <div className="flex w-full items-center gap-2">
                                <Checkbox
                                  isSelected={selectedIds.has(r.id)}
                                  onValueChange={(v) => toggleId(r.id, v)}
                                  classNames={{
                                    base: 'm-0 max-w-full flex-1 items-start',
                                    label: 'w-full',
                                  }}
                                  aria-label={`选择 ${r.file_name}`}
                                >
                                  <div className="flex min-w-0 flex-1 items-center gap-2 pr-1">
                                    <FileTypeIcon
                                      fileName={r.file_name}
                                      className="size-5 shrink-0 object-contain"
                                    />
                                    <span
                                      className="text-sm text-foreground"
                                      title={r.file_name}
                                    >
                                      {truncateFilenameMiddle(r.file_name)}
                                    </span>
                                  </div>
                                </Checkbox>
                                <span className="shrink-0 self-center text-[11px] tabular-nums text-default-400">
                                  {formatUploadDateShort(r.created_at)}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>
          </ModalBody>
          <ModalFooter className="border-t border-default-200">
            <Button variant="flat" onPress={onClose}>
              取消
            </Button>
            <Button color="primary" onPress={handleConfirm}>
              确定
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={uploadSubOpen}
        onClose={() => setUploadSubOpen(false)}
        size="3xl"
        scrollBehavior="inside"
        placement="center"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 border-b border-default-200 px-6 py-4">
            <span className="text-lg font-semibold">上传参考资料</span>
            <span className="text-xs font-normal text-default-500">
              选择文件、设置来源与保密后批量上传；完成后请关闭此窗口返回关联选择。
            </span>
          </ModalHeader>
          <ModalBody className="px-6 py-4">
            <WeeklyReferenceUploadPanel
              projectId={projectId}
              optionsLoading={false}
              onRefreshOptions={() => {
                onRefreshOptions()
              }}
              onEachUploadSuccess={(fileId) => {
                setSelectedIds((prev) => new Set([...prev, fileId]))
                onRefreshOptions()
              }}
            />
          </ModalBody>
          <ModalFooter className="border-t border-default-200">
            <Button variant="flat" onPress={() => setUploadSubOpen(false)}>
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
