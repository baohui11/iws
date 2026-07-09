'use client'

import { Button, Chip } from '@heroui/react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import {
  PROJECT_STAGE_IMPLEMENTATION,
  PROJECT_STAGE_LABEL,
  PROJECT_STAGE_SALES,
  type ProjectStageValue,
} from '@/constants/project-stage'
import { PROJECT_STATUS_LABEL } from '@/constants/project-status'
import { useProjectDetail } from '@/modules/weekly/components/projects/project-detail-context'

function stageSlug(stage: ProjectStageValue): 'sales' | 'delivery' {
  return stage === PROJECT_STAGE_SALES ? 'sales' : 'delivery'
}

function stageFromPathname(pathname: string): ProjectStageValue {
  return pathname.includes('/sales')
    ? PROJECT_STAGE_SALES
    : PROJECT_STAGE_IMPLEMENTATION
}

export function ProjectStageShell({
  projectId,
  children,
}: {
  projectId: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { project, visibleStages } = useProjectDetail()
  const stages = visibleStages
  const activeStage = stageFromPathname(pathname)
  const safeActiveStage = stages.includes(activeStage) ? activeStage : stages[0]

  useEffect(() => {
    if (stages.includes(activeStage) || !safeActiveStage) return
    router.replace(`/weekly/projects/${projectId}/${stageSlug(safeActiveStage)}`)
  }, [activeStage, projectId, router, safeActiveStage, stages])

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-default-200 bg-default-50/60 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-default-500">
                {project.project_no ?? '-'}
              </span>
              {project.project_status ? (
                <Chip size="sm" variant="flat" color="success">
                  {PROJECT_STATUS_LABEL[project.project_status] ??
                    project.project_status}
                </Chip>
              ) : null}
              {project.project_stage ? (
                <Chip size="sm" variant="flat" color="primary">
                  {project.project_stage}
                </Chip>
              ) : null}
            </div>
            <h1 className="mt-2 line-clamp-2 text-xl font-semibold text-foreground">
              {project.project_name ?? project.project_no ?? '项目详情'}
            </h1>
          </div>
          <div className="flex w-fit shrink-0 rounded-medium border border-default-200 bg-content1 p-1">
            {stages.map((stage) => (
              <Button
                key={stage}
                size="sm"
                variant={safeActiveStage === stage ? 'solid' : 'light'}
                color={safeActiveStage === stage ? 'primary' : 'default'}
                className="px-4"
                onPress={() =>
                  router.push(`/weekly/projects/${projectId}/${stageSlug(stage)}`)
                }
              >
                {PROJECT_STAGE_LABEL[stage]}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {children}
    </div>
  )
}
