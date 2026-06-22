'use client'

import Link from 'next/link'
import { Button, Chip, cn } from '@heroui/react'
import { Icon } from '@iconify/react'
import { SubpageBackButton } from '@/components/common/subpage-header'
import ProjectWeekExportButton from '@/components/weekly/project-week-export-button'
import { formatWeekTitleZh } from '@/lib/utils/week-display'
import { formatWorkSlotsBriefZh } from '@/lib/utils/weekly-report-work-slots'
import type { ProjectWeekWorkItemsPage } from '@/types/weekly-reports'

export interface ProjectWeekDetailViewProps {
  projectId: string
  data: ProjectWeekWorkItemsPage
}

export default function ProjectWeekDetailView({
  projectId,
  data,
}: ProjectWeekDetailViewProps) {
  const w = data
  const list = w.workItems
  const weekTitle = formatWeekTitleZh(w.week_code)

  return (
    <div className="space-y-6">
      {/* 与 WeeklyReportDetailView 首卡一致：项目名单独标题，周次与日期在下一行 */}
      <div className="rounded-xl border border-default-200/80 bg-content1 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {w.projectName?.trim() || '—'}
              </h1>
              {w.is_no_work_week ? (
                <Chip
                  size="sm"
                  variant="flat"
                  color="warning"
                  classNames={{ base: 'h-7' }}
                >
                  无工作周
                </Chip>
              ) : null}
              {w.is_current ? (
                <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                  本周
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-default-600">
              {weekTitle}
              {w.range_line ? ` · ${w.range_line}` : ''}
            </p>
            <p className="mt-1 text-xs text-default-500">
              本项目该周全部成员的本周工作事项
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ProjectWeekExportButton
              projectId={projectId}
              weekCode={w.week_code}
            />
            <SubpageBackButton variant="flat" />
          </div>
        </div>
      </div>

      <section
        className={cn(
          'overflow-hidden rounded-xl border bg-content1 p-5 shadow-sm',
          w.is_no_work_week
            ? 'border-warning-300/60'
            : 'border-default-200/90'
        )}
      >
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-default-100 pb-4">
          <h2 className="text-base font-semibold text-foreground">工作事项</h2>
          <p className="text-sm text-default-600">
            共{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {list.length}
            </span>{' '}
            条
          </p>
        </div>

        {list.length === 0 ? (
          <p className="py-10 text-center text-sm text-default-500">
            {w.is_no_work_week
              ? '本周为无工作周，暂无工作事项。'
              : '暂无已提交的本周工作事项。'}
          </p>
        ) : (
          <ul className="divide-y divide-default-100">
            {list.map((row) => {
              const it = row.item
              const slotLabel = formatWorkSlotsBriefZh(it.work_slots)
              const days =
                it.work_days != null
                  ? it.work_days
                  : it.work_slots.length * 0.5
              return (
                <li key={it.id} className="py-5 first:pt-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {row.author_name}
                    </p>
                    <Button
                      as={Link}
                      href={`/weekly/reports/${row.report_id}`}
                      size="sm"
                      variant="light"
                      color="primary"
                      className="h-8 min-h-8 font-medium"
                      endContent={
                        <Icon icon="lucide:chevron-right" className="size-4" />
                      }
                    >
                      查看周报
                    </Button>
                  </div>
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
                    <div className="mt-3 border-t border-default-100 pt-3">
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
                </li>
              )
            })}
          </ul>
        )}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-default-100 pt-4">
          <Button
            as={Link}
            href={`/weekly/projects/${projectId}/reports`}
            size="sm"
            variant="flat"
            color="default"
          >
            返回项目周报
          </Button>
        </div>
      </section>
    </div>
  )
}
