'use client'

import SearchableMultiSelect from '@/components/weekly/filters/searchable-multi-select'
import type { MemberProjectOption } from '@/types/weekly-reports'

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
  const items = projects.map((p) => {
    const name = p.project_name ?? p.project_no ?? p.id
    return {
      key: p.id,
      searchText: `${name} ${p.project_no ?? ''}`,
      children: <span className="text-sm">{name}</span>,
    }
  })

  return (
    <SearchableMultiSelect
      items={items}
      selectedKeys={selectedKeys}
      onSelectionChange={onSelectionChange}
      allLabel="全部项目"
      ariaLabel="项目"
      className={className}
      isDisabled={isDisabled}
    />
  )
}
