'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { showResultError } from '@/core/client/errors'
import {
  Button,
  Select,
  SelectItem,
  Spinner,
  Tab,
  Tabs,
} from '@heroui/react'
import { loadFileUploadOptions } from '@/modules/files/upload/actions'
import type {
  FileUploadOptionsPayload,
  MemberActiveProjectOption,
} from '@/modules/files/types'
import WeeklyDeliverableUploadPanel from '@/modules/files/components/upload/weekly-deliverable-upload-panel'
import WeeklyReferenceUploadPanel from '@/modules/files/components/upload/weekly-reference-upload-panel'
import ProjectSearchSelect from '@/modules/projects/components/project-search-select'
import {
  PROJECT_STAGE_IMPLEMENTATION,
  PROJECT_STAGE_LABEL,
  PROJECT_STAGE_SALES,
  type ProjectStageValue,
} from '@/constants/project-stage'

export interface WeeklyFileUploadPageClientProps {
  initialProjects: MemberActiveProjectOption[]
  maxFileLabel: string
  /** 从周报等入口带入，预选项目 */
  initialProjectId?: string
  initialProjectStage?: ProjectStageValue
  /** 上传完成后可回到的页面（如周报填写） */
  returnToHref?: string
  linkTargetKey?: string
}

export default function WeeklyFileUploadPageClient({
  initialProjects,
  maxFileLabel,
  initialProjectId,
  initialProjectStage,
  returnToHref,
  linkTargetKey,
}: WeeklyFileUploadPageClientProps) {
  const [projectId, setProjectId] = useState(initialProjectId ?? '')
  const initialProject = initialProjects.find((p) => p.id === initialProjectId)
  const initialStages = initialProject?.available_project_stages ?? []
  const [projectStage, setProjectStage] = useState<ProjectStageValue>(
    initialProjectStage && initialStages.includes(initialProjectStage)
      ? initialProjectStage
      : (initialStages[0] ?? PROJECT_STAGE_IMPLEMENTATION)
  )
  const [options, setOptions] = useState<FileUploadOptionsPayload | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)

  const loadOptions = useCallback(
    async (
      pid: string,
      stage: ProjectStageValue,
      opts: { keepPrevious?: boolean } = {}
    ) => {
      const { keepPrevious = false } = opts
      if (!pid) {
        setOptions(null)
        return
      }
      setOptionsLoading(true)
      if (!keepPrevious) setOptions(null)
      const result = await loadFileUploadOptions(pid, stage)
      setOptionsLoading(false)
      if (result.success) {
        setOptions(result.data)
      } else if (!keepPrevious) {
        setOptions(null)
        showResultError(result, '加载失败')
      } else {
        showResultError(result, '刷新失败')
      }
    },
    []
  )

  useEffect(() => {
    // 选中项目变化时按需拉取上传选项（外部数据同步）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOptions(projectId, projectStage, { keepPrevious: false })
  }, [projectId, projectStage, loadOptions])

  const onRefreshOptions = useCallback(() => {
    if (projectId) void loadOptions(projectId, projectStage, { keepPrevious: true })
  }, [projectId, projectStage, loadOptions])

  const selectedProject = initialProjects.find((p) => p.id === projectId)
  const stageOptions =
    selectedProject?.available_project_stages.length
      ? selectedProject.available_project_stages
      : [PROJECT_STAGE_IMPLEMENTATION]

  return (
    <div className="space-y-8">
      {returnToHref ? (
        <div className="flex flex-wrap gap-2">
          <Button
            as={Link}
            href={returnToHref}
            size="sm"
            variant="flat"
            color="primary"
          >
            完成上传，返回周报
          </Button>
        </div>
      ) : null}
      <div className="space-y-2">
        <ProjectSearchSelect
          projects={initialProjects}
          value={projectId}
          className="w-full max-w-xl"
          onChange={(id, project) => {
            setProjectId(id)
            setProjectStage(
              project?.available_project_stages[0] ?? PROJECT_STAGE_IMPLEMENTATION
            )
          }}
          isDisabled={optionsLoading && !options}
        />
        <Select
          label="阶段"
          placeholder="选择阶段"
          variant="bordered"
          className="w-full max-w-xl"
          selectedKeys={new Set([projectStage])}
          isDisabled={!projectId || optionsLoading || stageOptions.length === 1}
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
        <p className="text-xs text-default-400">单文件最大 {maxFileLabel}</p>
      </div>

      {!projectId ? (
        <p className="text-center text-sm text-default-500">请选择项目</p>
      ) : optionsLoading && !options ? (
        <div className="flex justify-center py-16">
          <Spinner label="加载中…" />
        </div>
      ) : !options ? (
        <p className="text-center text-sm text-danger">项目选项加载失败，请重试或切换项目</p>
      ) : (
        projectStage === PROJECT_STAGE_SALES ? (
          <WeeklyReferenceUploadPanel
            projectId={projectId}
            projectStage={projectStage}
            salesMode
            optionsLoading={optionsLoading}
            onRefreshOptions={onRefreshOptions}
            returnToHref={returnToHref}
            linkTargetKey={linkTargetKey}
          />
        ) : (
          <Tabs aria-label="上传类型" color="primary" variant="underlined" classNames={{ panel: 'pt-4' }}>
            <Tab key="d" title="成果文件">
              <WeeklyDeliverableUploadPanel
                projectId={projectId}
                projectStage={projectStage}
                deliverables={options.deliverables}
                existingDeliverableFiles={options.existingDeliverableFiles}
                referenceFiles={options.referenceFiles}
                optionsLoading={optionsLoading}
                onRefreshOptions={onRefreshOptions}
                returnToHref={returnToHref}
                linkTargetKey={linkTargetKey}
              />
            </Tab>
            <Tab key="r" title="参考资料">
              <WeeklyReferenceUploadPanel
                projectId={projectId}
                projectStage={projectStage}
                optionsLoading={optionsLoading}
                onRefreshOptions={onRefreshOptions}
              />
            </Tab>
          </Tabs>
        )
      )}
    </div>
  )
}
