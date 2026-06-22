'use client'

import { useProjectDetail } from '@/components/weekly/project-detail-context'
import ProjectFilesTab from '@/components/weekly/project-files-tab'

export default function ProjectFilesPage() {
  const { project } = useProjectDetail()
  return <ProjectFilesTab projectId={project.id} />
}
