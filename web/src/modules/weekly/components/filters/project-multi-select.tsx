'use client'

import ProjectSearchMultiSelect from '@/modules/projects/components/project-search-multi-select'
import type { MemberProjectOption } from '@/modules/weekly/types'

interface ProjectMultiSelectProps {
  projects: MemberProjectOption[]
  selectedKeys: Set<string>
  onSelectionChange: (keys: Set<string>) => void
  isDisabled?: boolean
  className?: string
}

export default function ProjectMultiSelect({
  projects,
  selectedKeys,
  onSelectionChange,
  isDisabled,
  className,
}: ProjectMultiSelectProps) {
  return (
    <ProjectSearchMultiSelect
      projects={projects}
      selectedKeys={selectedKeys}
      onSelectionChange={onSelectionChange}
      className={className}
      isDisabled={isDisabled}
    />
  )
}
