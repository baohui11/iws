'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Chip, addToast } from '@heroui/react'
import { Icon } from '@iconify/react'
import { SubpageBackButton } from '@/components/common/subpage-header'
import ConfirmActionModal from '@/components/common/confirm-action-modal'
import {
  WEEKLY_REPORT_STATUS_COLOR,
  WEEKLY_REPORT_STATUS_LABEL,
  isWeeklyReportEditableStatus,
} from '@/constants/weekly-report-status'
import { formatWeekRangeLine, formatWeekTitleZh } from '@/modules/weekly/lib/week-display'
import { formatWorkSlotsBriefZh } from '@/modules/weekly/lib/weekly-report-work-slots'
import type { WeeklyReportDetailPayload } from '@/modules/weekly/types'
import { withdrawWeeklyReportAction } from '@/modules/weekly/report-editor/actions'
import { showResultError } from '@/core/client/errors'

export interface WeeklyReportDetailViewProps {
  detail: WeeklyReportDetailPayload
  viewerId: string
}

export default function WeeklyReportDetailView({
  detail,
  viewerId,
}: WeeklyReportDetailViewProps) {
  const router = useRouter()
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = useState(false)
  const { report, week, next_week, project, author_name, items, reject_reason } =
    detail
  const isAuthor = viewerId === report.user_id
  const canEditDraft = isAuthor && isWeeklyReportEditableStatus(report.status)
  const canWithdraw =
    isAuthor && (report.status === 'pending' || report.status === 'approved')

  const editHref = `/weekly/reports/new?projectId=${encodeURIComponent(report.project_id)}&weekCode=${encodeURIComponent(report.week_code)}&projectStage=${encodeURIComponent(report.project_stage)}`

  const withdraw = async () => {
    if (withdrawing) return
    setWithdrawing(true)
    const result = await withdrawWeeklyReportAction({ reportId: report.id })
    setWithdrawing(false)
    if (!result.success) {
      showResultError(result, '撤回失败')
      return
    }
    addToast({ title: '已撤回', color: 'success' })
    setWithdrawConfirmOpen(false)
    router.refresh()
  }

  const workItems = items.filter((i) => i.item_type === 'work')
  const planItems = items.filter((i) => i.item_type === 'plan')

  const renderItemBlock = (
    it: (typeof items)[0],
    index: number,
    section: 'work' | 'plan'
  ) => {
    const slotLabel = formatWorkSlotsBriefZh(it.work_slots)
    const days =
      it.work_days != null
        ? it.work_days
        : it.work_slots.length * 0.5
    return (
      <div
        key={it.id}
        className="rounded-xl border border-default-200/90 bg-content1 p-5 shadow-sm"
      >
        <p className="text-sm font-semibold text-foreground">
          {section === 'work' ? '本周工作内容' : '下周工作计划'} {index + 1}
        </p>
        <p className="mt-2 text-xs text-default-500">
          工作日期：{slotLabel}
          <span className="ms-2 font-medium tabular-nums text-foreground">
            · {days} 天
          </span>
        </p>
        {it.item_desc ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-default-800">
            {it.item_desc}
          </p>
        ) : null}
        {it.files.length > 0 ? (
          <div className="mt-4 border-t border-default-100 pt-3">
            <p className="mb-2 text-xs font-medium text-default-600">
              关联成果文件
            </p>
            <ul className="space-y-1">
              {it.files.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/files/${f.id}/preview`}
                    className="text-sm text-primary hover:underline"
                  >
                    {f.file_name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-default-200/80 bg-content1 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {project.project_name ?? '—'}
              </h1>
              <Chip
                size="sm"
                variant="flat"
                color={WEEKLY_REPORT_STATUS_COLOR[report.status]}
              >
                {WEEKLY_REPORT_STATUS_LABEL[report.status]}
              </Chip>
              {report.is_overdue ? (
                <Chip size="sm" variant="flat" color="warning">
                  逾期
                </Chip>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-default-600">
              {formatWeekTitleZh(report.week_code)} ·{' '}
              {formatWeekRangeLine(week.start_date, week.end_date)}
            </p>
            <p className="mt-1 text-xs text-default-500">
              填写人：{author_name ?? '—'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SubpageBackButton variant="flat" href="/weekly/reports" />
            {canEditDraft ? (
              <Button
                as={Link}
                href={editHref}
                color="primary"
                size="sm"
                startContent={<Icon icon="lucide:pencil" className="size-4" />}
              >
                继续编辑
              </Button>
            ) : null}
            {canWithdraw ? (
              <Button
                color="warning"
                variant="flat"
                size="sm"
                isLoading={withdrawing}
                startContent={
                  !withdrawing ? (
                    <Icon icon="lucide:undo-2" className="size-4" />
                  ) : null
                }
                onPress={() => setWithdrawConfirmOpen(true)}
              >
                撤回
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmActionModal
        isOpen={withdrawConfirmOpen}
        title="撤回周报"
        description="撤回后该周报会回到可编辑状态，修改完成后需要重新提交。"
        confirmText="确认撤回"
        confirmColor="warning"
        isLoading={withdrawing}
        onClose={() => {
          if (!withdrawing) setWithdrawConfirmOpen(false)
        }}
        onConfirm={() => void withdraw()}
      />

      {report.status === 'rejected' ? (
        <div className="rounded-xl border border-danger-200/80 bg-danger-50/40 p-5 shadow-sm dark:bg-danger-950/20">
          <p className="text-sm font-semibold text-danger-700 dark:text-danger-400">
            驳回理由
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-default-800">
            {reject_reason?.trim() ? reject_reason.trim() : '—'}
          </p>
        </div>
      ) : null}

      <div className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            本周工作内容
          </h2>
          {workItems.length === 0 ? (
            <p className="rounded-xl border border-dashed border-default-200 py-8 text-center text-sm text-default-500">
              暂无本周事项
            </p>
          ) : (
            workItems.map((it, i) => renderItemBlock(it, i, 'work'))
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              下周工作计划
            </h2>
            <p className="mt-1 text-xs text-default-500">
              日期范围{' '}
              {formatWeekRangeLine(next_week.start_date, next_week.end_date)}
            </p>
          </div>
          {planItems.length === 0 ? (
            <p className="rounded-xl border border-dashed border-default-200 py-8 text-center text-sm text-default-500">
              暂无下周计划
            </p>
          ) : (
            planItems.map((it, i) => renderItemBlock(it, i, 'plan'))
          )}
        </section>
      </div>
    </div>
  )
}
