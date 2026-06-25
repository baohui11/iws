'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button, Select, SelectItem } from '@heroui/react'
import { Icon } from '@iconify/react'
import type { MemberProjectOption, WeekOption } from '@/modules/weekly/types'

export interface WeeklyReportScopePickerProps {
  projects: MemberProjectOption[]
  weekOptions: WeekOption[]
}

export default function WeeklyReportScopePicker({
  projects,
  weekOptions,
}: WeeklyReportScopePickerProps) {
  const router = useRouter()
  const [projectId, setProjectId] = useState('')
  const [weekCode, setWeekCode] = useState('')

  const start = () => {
    if (!projectId || !weekCode) return
    const q = new URLSearchParams({
      projectId,
      weekCode,
    })
    router.push(`/weekly/reports/new?${q.toString()}`)
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-2xl border border-default-200/80 bg-content1 p-6 shadow-sm">
      <p className="text-sm text-default-600">
        请先选择要填写的项目和周次，再添加工作事项。
      </p>
      <Select
        label="项目"
        placeholder="选择项目"
        variant="bordered"
        selectedKeys={projectId ? new Set([projectId]) : new Set()}
        onSelectionChange={(keys) => {
          const k = [...keys][0] as string | undefined
          setProjectId(k ?? '')
        }}
      >
        {projects.map((p) => (
          <SelectItem key={p.id} textValue={p.project_name ?? p.project_no ?? p.id}>
            {p.project_name ?? p.project_no ?? p.id}
          </SelectItem>
        ))}
      </Select>

      <Select
        label="周次"
        placeholder="选择周次"
        variant="bordered"
        selectedKeys={weekCode ? new Set([weekCode]) : new Set()}
        onSelectionChange={(keys) => {
          const k = [...keys][0] as string | undefined
          setWeekCode(k ?? '')
        }}
      >
        {weekOptions.map((w) => (
          <SelectItem
            key={w.week_code}
            textValue={`${w.title_zh} ${w.range_line ?? ''}`}
          >
            <div className="flex flex-col gap-0.5">
              <span>{w.title_zh}</span>
              {w.range_line ? (
                <span className="text-xs text-default-400">{w.range_line}</span>
              ) : null}
            </div>
          </SelectItem>
        ))}
      </Select>

      <Button
        color="primary"
        className="w-full"
        isDisabled={!projectId || !weekCode}
        startContent={<Icon icon="lucide:arrow-right" className="size-4" />}
        onPress={start}
      >
        开始填写
      </Button>
    </div>
  )
}
