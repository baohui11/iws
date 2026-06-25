'use client'

import { useProjectDetail } from '@/modules/weekly/components/projects/project-detail-context'
import ProjectWeeklyReportsTab from '@/modules/weekly/components/project-weekly/project-weekly-reports-tab'

export default function ProjectReportsPage() {
  const { project, initialProjectWeekly } = useProjectDetail()
  return (
    <ProjectWeeklyReportsTab
      projectId={project.id}
      initial={initialProjectWeekly}
    />
  )
}
