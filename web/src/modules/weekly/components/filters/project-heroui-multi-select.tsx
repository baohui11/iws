'use client'

import ProjectSearchMultiSelect from '@/modules/projects/components/project-search-multi-select'
import type { MemberProjectOption } from '@/modules/weekly/types'

interface ProjectHerouiMultiSelectProps {
  projects: MemberProjectOption[]
  selectedKeys: Set<string>
  onSelectionChange: (keys: Set<string>) => void
  isDisabled?: boolean
  className?: string
}

export default function ProjectHerouiMultiSelect({
  projects,
  selectedKeys,
  onSelectionChange,
  isDisabled,
  className,
}: ProjectHerouiMultiSelectProps) {
  return (
    <ProjectSearchMultiSelect
      projects={projects}
      selectedKeys={selectedKeys}
      onSelectionChange={onSelectionChange}
      isDisabled={isDisabled}
      className={className}
    />
  )
}
