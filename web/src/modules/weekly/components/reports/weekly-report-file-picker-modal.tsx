'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Button,
  Checkbox,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import { showResultError } from '@/core/client/errors'
import { PROJECT_STAGE_SALES, type ProjectStageValue } from '@/constants/project-stage'
import { loadWeeklyReportFilesForPickerAction } from '@/modules/weekly/report-editor/actions'
import type { WeeklyReportFilePickRow } from '@/modules/weekly/types'

export interface WeeklyReportFilePickerModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (fileIds: string[], picked: WeeklyReportFilePickRow[]) => void
  initialSelectedIds: string[]
  projectId: string
  projectStage: ProjectStageValue
  weekStartDate: string
  returnToHref: string
  linkTargetKey: string
}

export default function WeeklyReportFilePickerModal({
  isOpen,
  onClose,
  onConfirm,
  initialSelectedIds,
  projectId,
  projectStage,
  weekStartDate,
  returnToHref,
  linkTargetKey,
}: WeeklyReportFilePickerModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSelectedIds)
  )
  const [rows, setRows] = useState<WeeklyReportFilePickRow[]>([])
  const [loading, setLoading] = useState(false)

  const isSalesStage = projectStage === PROJECT_STAGE_SALES
  const title = isSalesStage ? '关联销售文件' : '关联成果文件'
  const uploadLabel = isSalesStage ? '上传销售文件' : '上传成果文件'
  const emptyText = isSalesStage
    ? '暂无符合条件的销售文件，请先上传'
    : '暂无符合条件的成果文件，请先上传'
  const uploadHref = `/weekly/files/upload?projectId=${encodeURIComponent(
    projectId
  )}&projectStage=${encodeURIComponent(projectStage)}&returnTo=${encodeURIComponent(
    returnToHref
  )}&linkTargetKey=${encodeURIComponent(linkTargetKey)}`

  const rowById = useMemo(() => {
    const map = new Map<string, WeeklyReportFilePickRow>()
    for (const row of rows) map.set(row.id, row)
    return map
  }, [rows])

  const loadRows = useCallback(async () => {
    if (!projectId || !weekStartDate) return
    setLoading(true)
    const res = await loadWeeklyReportFilesForPickerAction({
      projectId,
      weekStartDate,
      projectStage,
    })
    setLoading(false)
    if (!res.success) {
      setRows([])
      showResultError(res, '加载文件失败')
      return
    }
    setRows(res.data)
  }, [projectId, projectStage, weekStartDate])

  useEffect(() => {
    if (!isOpen) return
    const timer = window.setTimeout(() => {
      setSelectedIds(new Set(initialSelectedIds))
      void loadRows()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [initialSelectedIds, isOpen, loadRows])

  const toggleId = (id: string, on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
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
          <span className="text-lg font-semibold">{title}</span>
          <span className="text-xs font-normal text-default-500">
            列出填报周周一及之后上传的本项目{isSalesStage ? '销售文件' : '成果文件'}。
          </span>
        </ModalHeader>
        <ModalBody className="gap-4 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              as={Link}
              href={uploadHref}
              size="sm"
              color="primary"
              variant="flat"
              startContent={<Icon icon="lucide:upload" className="size-4" />}
            >
              {uploadLabel}
            </Button>
            <Button
              size="sm"
              variant="light"
              startContent={<Icon icon="lucide:refresh-cw" className="size-4" />}
              onPress={() => void loadRows()}
            >
              刷新列表
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-default-500">
              <Spinner size="sm" />
              加载中...
            </div>
          ) : rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-default-200 py-10 text-center text-sm text-default-500">
              {emptyText}
            </p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-default-200 p-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-default-100/80"
                >
                  <Checkbox
                    isSelected={selectedIds.has(row.id)}
                    onValueChange={(v) => toggleId(row.id, v)}
                    aria-label={row.file_name}
                    classNames={{ base: 'items-start pt-0.5' }}
                  />
                  <Icon
                    icon="lucide:file-text"
                    className="mt-0.5 size-4 shrink-0 text-default-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {row.file_name}
                    </p>
                    <p className="text-[11px] text-default-400">
                      {row.created_at.slice(0, 10)}
                      {row.version_label ? ` · ${row.version_label}` : ''}
                      {!row.is_latest ? ' · 历史版本' : ''}
                      {row.sales_file_tag ? ` · ${row.sales_file_tag}` : ''}
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
                  const row = rowById.get(id)
                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between gap-2 text-sm text-default-700"
                    >
                      <span className="min-w-0 truncate">
                        {row?.file_name ?? '已选文件'}
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
              const picked = ids
                .map((id) => rowById.get(id))
                .filter((row): row is WeeklyReportFilePickRow => Boolean(row))
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
