'use client'

import { Tab, Tabs } from '@heroui/react'
import {
  PROJECT_STAGE_SALES,
  type ProjectStageValue,
} from '@/constants/project-stage'
import ProjectFilesTab from '@/modules/files/components/project-files/project-files-tab'
import ProjectWeeklyReportsTab from '@/modules/weekly/components/project-weekly/project-weekly-reports-tab'
import { useProjectDetail } from '@/modules/weekly/components/projects/project-detail-context'
import ProjectInfoTabContent from '@/modules/weekly/components/projects/project-info-tab-content'

export default function ProjectStageWorkspace({
  stage,
}: {
  stage: ProjectStageValue
}) {
  const { project, initialProjectWeekly, visibleStages } = useProjectDetail()
  const activeStage =
    project.project_stage === PROJECT_STAGE_SALES && stage !== PROJECT_STAGE_SALES
      ? PROJECT_STAGE_SALES
      : visibleStages.includes(stage)
        ? stage
        : visibleStages[0]

  return (
    <section className="rounded-lg border border-default-200 bg-content1 p-4">
      <Tabs
        aria-label="项目详情"
        color="primary"
        variant="underlined"
        classNames={{
          tabList: 'gap-6',
          panel: 'pt-4',
        }}
      >
        <Tab key="reports" title="项目周报">
          <ProjectWeeklyReportsTab
            projectId={project.id}
            initial={initialProjectWeekly}
            projectStage={activeStage}
          />
        </Tab>
        <Tab key="files" title="项目文件">
          <ProjectFilesTab projectId={project.id} projectStage={activeStage} />
        </Tab>
        <Tab key="info" title="项目信息">
          <ProjectInfoTabContent projectStage={activeStage} />
        </Tab>
      </Tabs>
    </section>
  )
}
