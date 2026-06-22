'use client'

import { useCallback, useEffect, useState } from 'react'
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
import Link from 'next/link'
import FileTypeIcon from '@/components/weekly/file-type-icon'
import { formatUploadDateShort } from '@/lib/utils/format-upload-date'
import { truncateFilenameMiddle } from '@/lib/utils/truncate-filename-middle'
import { loadDeliverableFilesForWeeklyPickerAction } from '@/actions/weekly/report-editor.action'
import type { DeliverablePickRow } from '@/types/weekly-report-editor'

export interface WeeklyReportDeliverablePickerModalProps {
  isOpen: boolean
  onClose: () => void
  /** 返回所选 id 及对应行（用于展示文件名） */
  onConfirm: (fileIds: string[], picked: DeliverablePickRow[]) => void
  initialSelectedIds: string[]
  projectId: string
  weekStartDate: string
  returnToHref: string
}

export default function WeeklyReportDeliverablePickerModal({
  isOpen,
  onClose,
  onConfirm,
  initialSelectedIds,
  projectId,
  weekStartDate,
  returnToHref,
}: WeeklyReportDeliverablePickerModalProps) {
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(initialSelectedIds)
  )
  const [rows, setRows] = useState<DeliverablePickRow[]>([])
  const [loading, setLoading] = useState(false)

  const loadRows = useCallback(() => {
    if (!projectId || !weekStartDate) return
    setLoading(true)
    void loadDeliverableFilesForWeeklyPickerAction({
      projectId,
      weekStartDate,
    }).then((res) => {
      setLoading(false)
      if (res.success && res.data) setRows(res.data)
      else setRows([])
    })
  }, [projectId, weekStartDate])

  useEffect(() => {
    if (!isOpen || !projectId || !weekStartDate) return
    queueMicrotask(() => {
      loadRows()
    })
  }, [isOpen, projectId, weekStartDate, loadRows])

  const toggleId = (id: string, on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const metaForId = (id: string): DeliverablePickRow =>
    rows.find((r) => r.id === id) ?? {
      id,
      file_name: '（文件）',
      created_at: '',
      version_label: null,
      is_latest: true,
    }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      placement="center"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 border-b border-default-200 px-6 py-4">
          <span className="text-lg font-semibold">关联成果文件</span>
          <span className="text-xs font-normal text-default-500">
            列出填报周起始日之后上传的本项目成果文件（含历史版本）；可勾选或去上传新文件后刷新。
          </span>
        </ModalHeader>
        <ModalBody className="gap-4 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              as={Link}
              href={`/weekly/files/upload?projectId=${encodeURIComponent(projectId)}&returnTo=${encodeURIComponent(returnToHref)}`}
              size="sm"
              color="primary"
              variant="flat"
              startContent={<Icon icon="lucide:upload" className="size-4" />}
            >
              上传新文件
            </Button>
            <Button
              size="sm"
              variant="light"
              startContent={<Icon icon="lucide:refresh-cw" className="size-4" />}
              onPress={() => loadRows()}
            >
              刷新列表
            </Button>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-default-500">加载中…</p>
          ) : rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-default-200 py-10 text-center text-sm text-default-500">
              暂无符合条件的成果文件，请先上传
            </p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-default-200 p-2">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-default-100/80"
                >
                  <Checkbox
                    isSelected={selectedIds.has(r.id)}
                    onValueChange={(v) => toggleId(r.id, v)}
                    aria-label={r.file_name}
                    classNames={{ base: 'items-start pt-0.5' }}
                  />
                  <FileTypeIcon fileName={r.file_name} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {truncateFilenameMiddle(r.file_name, 42)}
                    </p>
                    <p className="text-[11px] text-default-400">
                      {formatUploadDateShort(r.created_at)}
                      {r.version_label ? ` · ${r.version_label}` : ''}
                      {!r.is_latest ? ' · 历史版本' : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {selectedIds.size > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-default-600">已选</p>
              <ul className="space-y-1">
                {[...selectedIds].map((id) => {
                  const m = metaForId(id)
                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between gap-2 text-sm text-default-700"
                    >
                      <span className="min-w-0 truncate">
                        {truncateFilenameMiddle(m.file_name, 48)}
                      </span>
                      <Button
                        size="sm"
                        variant="light"
                        isIconOnly
                        aria-label="移除"
                        onPress={() => toggleId(id, false)}
                      >
                        <Icon icon="lucide:x" className="size-4" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </ModalBody>
        <ModalFooter className="border-t border-default-200">
          <Button variant="light" onPress={onClose}>
            取消
          </Button>
          <Button
            color="primary"
            onPress={() => {
              const ids = [...selectedIds]
              const picked = rows.filter((r) => ids.includes(r.id))
              onConfirm(ids, picked)
              onClose()
            }}
          >
            确定
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
