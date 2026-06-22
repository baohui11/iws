'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
  addToast,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import WeeklyReportDetailView from '@/components/weekly/weekly-report-detail-view'
import { submitWeeklyReportApprovalDecisionAction } from '@/actions/weekly/report-editor.action'
import type { WeeklyReportDetailPayload } from '@/types/weekly-report-editor'

export interface WeeklyReportReviewClientProps {
  detail: WeeklyReportDetailPayload
  viewerId: string
  myApproval: {
    action: 'approve' | 'reject'
    reject_reason: string | null
    approved_at: string | null
  } | null
  canApprove: boolean
}

export default function WeeklyReportReviewClient({
  detail,
  viewerId,
  myApproval,
  canApprove,
}: WeeklyReportReviewClientProps) {
  const router = useRouter()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleApprove() {
    setBusy(true)
    try {
      const r = await submitWeeklyReportApprovalDecisionAction({
        reportId: detail.report.id,
        decision: 'approve',
      })
      if (!r.success) {
        addToast({ title: r.message ?? '操作失败', color: 'danger' })
        return
      }
      addToast({ title: '已通过', color: 'success', timeout: 2000 })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function handleRejectSubmit() {
    const trimmed = rejectReason.trim()
    if (!trimmed) {
      addToast({ title: '请填写驳回原因', color: 'warning' })
      return
    }
    setBusy(true)
    try {
      const r = await submitWeeklyReportApprovalDecisionAction({
        reportId: detail.report.id,
        decision: 'reject',
        rejectReason: trimmed,
      })
      if (!r.success) {
        addToast({ title: r.message ?? '操作失败', color: 'danger' })
        return
      }
      addToast({ title: '已驳回', color: 'success', timeout: 2000 })
      setRejectOpen(false)
      setRejectReason('')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <WeeklyReportDetailView detail={detail} viewerId={viewerId} />

      <div className="rounded-xl border border-default-200/80 bg-content1 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">审批</h2>
        {canApprove ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              color="success"
              variant="flat"
              startContent={<Icon icon="lucide:check" className="size-4" />}
              isLoading={busy}
              onPress={handleApprove}
            >
              通过
            </Button>
            <Button
              color="danger"
              variant="flat"
              startContent={<Icon icon="lucide:x" className="size-4" />}
              isLoading={busy}
              onPress={() => setRejectOpen(true)}
            >
              驳回
            </Button>
          </div>
        ) : myApproval ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-default-600">
              我的处理：
              <span className="ms-1 font-medium text-foreground">
                {myApproval.action === 'approve' ? '已通过' : '已驳回'}
              </span>
              {myApproval.approved_at ? (
                <span className="ms-2 text-xs text-default-400 tabular-nums">
                  {new Date(myApproval.approved_at).toLocaleString('zh-CN')}
                </span>
              ) : null}
            </p>
            {myApproval.action === 'reject' && myApproval.reject_reason ? (
              <p className="rounded-lg bg-danger-50/50 p-3 text-default-800">
                <span className="text-xs font-medium text-danger-600">
                  驳回原因
                </span>
                <span className="mt-1 block whitespace-pre-wrap">
                  {myApproval.reject_reason}
                </span>
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-default-500">
            {detail.report.status === 'pending'
              ? '该周报待其他审批人处理，或您已无法再次操作。'
              : '该周报已处理，仅可查看。'}
          </p>
        )}
      </div>

      <Modal
        isOpen={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open)
          if (!open) setRejectReason('')
        }}
        size="lg"
      >
        <ModalContent>
          <ModalHeader className="border-b border-default-200">
            驳回周报
          </ModalHeader>
          <ModalBody className="gap-3 py-4">
            <p className="text-sm text-default-500">
              请说明驳回原因，填写人将能看到该说明。
            </p>
            <Textarea
              label="驳回原因"
              placeholder="必填"
              minRows={4}
              value={rejectReason}
              onValueChange={setRejectReason}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={() => setRejectOpen(false)}
              isDisabled={busy}
            >
              取消
            </Button>
            <Button color="danger" isLoading={busy} onPress={handleRejectSubmit}>
              确认驳回
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
