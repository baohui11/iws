'use client'

import Link from 'next/link'
import { Button, Chip } from '@heroui/react'
import { Icon } from '@iconify/react'

interface WeeklyReportsHeaderActionsProps {
  pendingCount: number
  /** 至少担任一个项目的项目经理时才显示「周报审批」「项目管理」 */
  showPmActions: boolean
}

export default function WeeklyReportsHeaderActions({
  pendingCount,
  showPmActions,
}: WeeklyReportsHeaderActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        as={Link}
        href="/weekly/reports/new"
        color="primary"
        size="sm"
        className="font-medium"
        startContent={<Icon icon="lucide:plus" className="size-4" aria-hidden />}
      >
        新建周报
      </Button>

      {showPmActions ? (
        <>
          <Button
            as={Link}
            href="/weekly/reports/approvals"
            variant="bordered"
            size="sm"
            className="min-w-0 border-default-200 font-medium"
            startContent={
              <Icon icon="lucide:clipboard-check" className="size-4" aria-hidden />
            }
          >
            <span className="flex items-center gap-2">
              周报审批
              {pendingCount > 0 ? (
                <Chip
                  size="sm"
                  variant="flat"
                  color="warning"
                  classNames={{
                    base: 'h-5 min-h-5 min-w-5 px-1.5',
                    content: 'px-0 text-xs font-semibold tabular-nums',
                  }}
                >
                  {pendingCount > 99 ? '99+' : pendingCount}
                </Chip>
              ) : null}
            </span>
          </Button>
        </>
      ) : null}
    </div>
  )
}
