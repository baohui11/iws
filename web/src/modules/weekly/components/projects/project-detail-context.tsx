'use client'

import { createContext, useContext } from 'react'
import type { ProjectDetail } from '@/modules/projects/types'
import type { ProjectWeeklyWeeksPage } from '@/modules/weekly/types'

export type ProjectDetailContextValue = {
  project: ProjectDetail
  departmentLabel: string
  initialProjectWeekly: ProjectWeeklyWeeksPage
}

const ProjectDetailContext = createContext<ProjectDetailContextValue | null>(
  null
)

export function ProjectDetailProvider({
  value,
  children,
}: {
  value: ProjectDetailContextValue
  children: React.ReactNode
}) {
  return (
    <ProjectDetailContext.Provider value={value}>
      {children}
    </ProjectDetailContext.Provider>
  )
}

export function useProjectDetail(): ProjectDetailContextValue {
  const v = useContext(ProjectDetailContext)
  if (!v) {
    throw new Error('useProjectDetail 必须在项目详情布局内使用')
  }
  return v
}
