'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button, Select, SelectItem } from '@heroui/react'
import { Icon } from '@iconify/react'
import type { MemberProjectOption, WeekOption } from '@/modules/weekly/types'
import ProjectSearchSelect from '@/modules/projects/components/project-search-select'
import WeekSearchSelect from '@/components/common/week-search-select'
import {
  PROJECT_STAGE_IMPLEMENTATION,
  PROJECT_STAGE_LABEL,
  PROJECT_STAGE_SALES,
  type ProjectStageValue,
} from '@/constants/project-stage'

export interface WeeklyReportScopePickerProps {
  projects: MemberProjectOption[]
  weekOptions: WeekOption[]
  initialProjectId?: string
  initialWeekCode?: string
  initialProjectStage?: ProjectStageValue
}

export default function WeeklyReportScopePicker({
  projects,
  weekOptions,
  initialProjectId,
  initialWeekCode,
  initialProjectStage,
}: WeeklyReportScopePickerProps) {
  const router = useRouter()
  const initialProject = projects.find((project) => project.id === initialProjectId)
  const initialStage =
    initialProjectStage ??
    initialProject?.available_project_stages[0] ??
    initialProject?.project_stage ??
    PROJECT_STAGE_IMPLEMENTATION
  const [projectId, setProjectId] = useState(initialProject?.id ?? '')
  const [weekCode, setWeekCode] = useState(initialWeekCode ?? '')
  const selectedProject = projects.find((project) => project.id === projectId)
  const stageOptions: ProjectStageValue[] =
    selectedProject?.available_project_stages.length
      ? selectedProject.available_project_stages
      : selectedProject?.project_stage === PROJECT_STAGE_SALES
      ? [PROJECT_STAGE_SALES]
      : [PROJECT_STAGE_IMPLEMENTATION, PROJECT_STAGE_SALES]
  const [projectStage, setProjectStage] =
    useState<ProjectStageValue>(initialStage)

  const start = () => {
    if (!projectId || !weekCode || !projectStage) return
    const q = new URLSearchParams({
      projectId,
      weekCode,
      projectStage,
    })
    router.push(`/weekly/reports/new?${q.toString()}`)
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-2xl border border-default-200/80 bg-content1 p-6 shadow-sm">
      <p className="text-sm text-default-600">
        请先选择要填写的项目和周次，再添加工作事项。
      </p>
      <ProjectSearchSelect
        projects={projects}
        value={projectId}
        onChange={(id, project) => {
          setProjectId(id)
          setProjectStage(
            project?.available_project_stages[0] ??
              project?.project_stage ??
              PROJECT_STAGE_IMPLEMENTATION
          )
        }}
      />

      <Select
        label="阶段"
        placeholder="选择阶段"
        variant="bordered"
        selectedKeys={new Set([projectStage])}
        isDisabled={!projectId || stageOptions.length === 1}
        onSelectionChange={(keys) => {
          const k = [...keys][0] as ProjectStageValue | undefined
          if (k) setProjectStage(k)
        }}
      >
        {stageOptions.map((stage) => (
          <SelectItem key={stage} textValue={PROJECT_STAGE_LABEL[stage]}>
            {PROJECT_STAGE_LABEL[stage]}
          </SelectItem>
        ))}
      </Select>

      <WeekSearchSelect
        weekOptions={weekOptions}
        value={weekCode}
        onChange={(code) => setWeekCode(code)}
      />

      <Button
        color="primary"
        className="w-full"
        isDisabled={!projectId || !weekCode || !projectStage}
        startContent={<Icon icon="lucide:arrow-right" className="size-4" />}
        onPress={start}
      >
        开始填写
      </Button>
    </div>
  )
}
