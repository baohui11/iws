'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, Chip, addToast } from '@heroui/react'
import { Icon } from '@iconify/react'
import {
  WEEKLY_REPORT_STATUS_COLOR,
  WEEKLY_REPORT_STATUS_LABEL,
} from '@/constants/weekly-report-status'
import { showResultError } from '@/core/client/errors'
import { deleteWeeklyReportAction } from '@/modules/weekly/report-editor/actions'
import ConfirmActionModal from '@/components/common/confirm-action-modal'
import type { MyFilledReportRow } from '@/modules/weekly/types'

function canDeleteReport(status: MyFilledReportRow['status']): boolean {
  return status === 'draft' || status === 'withdrawn'
}

export default function RecentReportsList({
  initialRows,
}: {
  initialRows: MyFilledReportRow[]
}) {
  const [rows, setRows] = useState(initialRows)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MyFilledReportRow | null>(null)

  const deleteReport = async () => {
    if (deletingId || !deleteTarget) return
    const reportId = deleteTarget.id
    setDeletingId(reportId)
    const result = await deleteWeeklyReportAction({ reportId })
    setDeletingId(null)
    if (!result.success) {
      showResultError(result, '删除失败')
      return
    }
    setRows((current) => current.filter((row) => row.id !== reportId))
    setDeleteTarget(null)
    addToast({ title: '已删除', color: 'success' })
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-default-200 py-10 text-center text-sm text-default-500">
        最近暂无周报记录
      </p>
    )
  }

  return (
    <div className="divide-y divide-default-100">
      {rows.map((report) => (
        <div
          key={report.id}
          className="flex flex-wrap items-center justify-between gap-3 py-3"
        >
          <Link href={`/weekly/reports/${report.id}`} className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {report.project_name ?? '-'}
            </p>
            <p className="mt-1 text-xs text-default-500">
              {report.week_code} · {report.project_stage} · {report.work_days} 天
            </p>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Chip
              size="sm"
              variant="flat"
              color={WEEKLY_REPORT_STATUS_COLOR[report.status]}
            >
              {WEEKLY_REPORT_STATUS_LABEL[report.status]}
            </Chip>
            {canDeleteReport(report.status) ? (
              <Button
                size="sm"
                variant="light"
                color="danger"
                isIconOnly
                aria-label="删除周报"
                isLoading={deletingId === report.id}
                onPress={() => setDeleteTarget(report)}
              >
                <Icon icon="lucide:trash-2" className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>
      ))}
      <ConfirmActionModal
        isOpen={deleteTarget !== null}
        title="删除周报"
        description="删除后该周报及其填写内容将不可恢复，请确认是否继续。"
        confirmText="确认删除"
        confirmColor="danger"
        isLoading={deletingId !== null}
        onClose={() => {
          if (!deletingId) setDeleteTarget(null)
        }}
        onConfirm={() => void deleteReport()}
      />
    </div>
  )
}
