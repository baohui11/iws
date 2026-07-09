'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { showResultError } from '@/core/client/errors'
import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  addToast,
} from '@heroui/react'
import ProjectSearchSelect from '@/modules/projects/components/project-search-select'
import WeekSearchSelect from '@/components/common/week-search-select'
import {
  addPmExemptionAction,
  removePmExemptionAction,
} from '@/modules/weekly/exemptions/actions'
import type {
  MemberProjectOption,
  ProjectWeekExemptionListRow,
  WeekOption,
} from '@/modules/weekly/types'
import { formatWeekCodeLabelZh } from '@/modules/weekly/lib/iso-week'

interface WeeklyExemptionsFormProps {
  projects: MemberProjectOption[]
  initialRows: ProjectWeekExemptionListRow[]
  weekOptions: WeekOption[]
}

function formatWeekCell(start: string, end: string | null) {
  const a = formatWeekCodeLabelZh(start)
  if (!end || end === start) return a
  return `${a} ～ ${formatWeekCodeLabelZh(end)}`
}

export default function WeeklyExemptionsForm({
  projects,
  initialRows,
  weekOptions,
}: WeeklyExemptionsFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [projectId, setProjectId] = useState<string>('')
  const [weekCode, setWeekCode] = useState<string>('')

  const handleSubmit = () => {
    if (!projectId) {
      addToast({ title: '请选择项目', color: 'warning' })
      return
    }
    if (!weekCode) {
      addToast({ title: '请选择周次', color: 'warning' })
      return
    }
    startTransition(async () => {
      const result = await addPmExemptionAction({
        projectId,
        weekCode,
      })
      if (result.success) {
        addToast({ title: '已保存无工作设置', color: 'success', timeout: 2000 })
        setWeekCode('')
        router.refresh()
      } else {
        showResultError(result, '保存失败')
      }
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await removePmExemptionAction(id)
      if (result.success) {
        addToast({ title: '已删除', color: 'success', timeout: 2000 })
        router.refresh()
      } else {
        showResultError(result, '删除失败')
      }
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-default-200/80 bg-content1 p-5 shadow-sm md:p-6">
        <h2 className="mb-1 text-base font-semibold tracking-tight text-foreground">
          添加无工作
        </h2>
        <p className="mb-5 max-w-2xl text-sm leading-relaxed text-default-500">
          为担任项目经理的项目，指定单个周次为无工作投入，则成员无需填写周报，数据统计中会标记。若该周已有成员提交周报（非草稿），则无法设置。
        </p>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto] sm:items-end">
          <ProjectSearchSelect
            projects={projects}
            value={projectId}
            onChange={(id) => setProjectId(id)}
            size="sm"
            className="w-full"
            isDisabled={isPending || projects.length === 0}
          />

          <WeekSearchSelect
            weekOptions={weekOptions}
            value={weekCode}
            onChange={(code) => setWeekCode(code)}
            size="sm"
            className="w-full"
            isDisabled={isPending || weekOptions.length === 0}
          />

          <Button
            color="primary"
            size="sm"
            className="h-10 w-full font-medium sm:w-auto sm:min-w-[7rem]"
            isLoading={isPending}
            onPress={handleSubmit}
          >
            保存
          </Button>
        </div>

        {projects.length === 0 ? (
          <p className="mt-4 text-sm text-warning-600">
            您当前没有担任项目经理的项目，无法添加无工作。
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-default-200/80 bg-content1 p-5 shadow-sm md:p-6">
        <h2 className="mb-4 text-base font-semibold tracking-tight text-foreground">
          已有记录
        </h2>
        {initialRows.length === 0 ? (
          <p className="text-sm text-default-500">暂无无工作记录</p>
        ) : (
          <Table
            removeWrapper
            aria-label="周报无工作列表"
            classNames={{
              base: 'gap-0',
              th: 'bg-default-100/80 text-default-600 first:rounded-s-lg last:rounded-e-lg',
              td: 'border-b border-default-100',
            }}
          >
            <TableHeader>
              <TableColumn>项目</TableColumn>
              <TableColumn>周次</TableColumn>
              <TableColumn>创建时间</TableColumn>
              <TableColumn align="end">操作</TableColumn>
            </TableHeader>
            <TableBody>
              {initialRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.project_name ?? '—'}
                  </TableCell>
                  <TableCell className="text-default-700">
                    {formatWeekCell(r.start_week_code, r.end_week_code)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-default-500">
                    {new Date(r.created_at).toLocaleString('zh-CN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        className="font-medium"
                        isDisabled={isPending}
                        onPress={() => handleDelete(r.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
