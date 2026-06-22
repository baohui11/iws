'use client'

import { useProjectDetail } from '@/components/weekly/project-detail-context'
import ProjectWeeklyReportsTab from '@/components/weekly/project-weekly-reports-tab'

export default function ProjectReportsPage() {
  const { project, initialProjectWeekly } = useProjectDetail()
  return (
    <ProjectWeeklyReportsTab
      projectId={project.id}
      initial={initialProjectWeekly}
    />
  )
}
