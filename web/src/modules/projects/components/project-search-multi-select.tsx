'use client'

import SearchableMultiSelect from '@/components/common/searchable-multi-select'
import type { ProjectSearchSelectOption } from '@/modules/projects/components/project-search-select'

interface ProjectSearchMultiSelectProps<T extends ProjectSearchSelectOption> {
  projects: T[]
  selectedKeys: Set<string>
  onSelectionChange: (keys: Set<string>) => void
  isDisabled?: boolean
  className?: string
  allLabel?: string
  ariaLabel?: string
}

function projectName(project: ProjectSearchSelectOption): string {
  return project.project_name?.trim() || project.project_no || project.id
}

export default function ProjectSearchMultiSelect<T extends ProjectSearchSelectOption>({
  projects,
  selectedKeys,
  onSelectionChange,
  isDisabled,
  className,
  allLabel = '全部项目',
  ariaLabel = '项目',
}: ProjectSearchMultiSelectProps<T>) {
  return (
    <SearchableMultiSelect
      items={projects.map((project) => {
        const name = projectName(project)
        return {
          key: project.id,
          searchText: `${project.project_name ?? ''} ${project.project_no ?? ''} ${
            project.department_name ?? ''
          }`,
          children: (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm">{name}</span>
              {project.project_no && project.project_no !== name ? (
                <span className="truncate text-xs text-default-400">
                  {project.project_no}
                </span>
              ) : null}
            </div>
          ),
        }
      })}
      selectedKeys={selectedKeys}
      onSelectionChange={onSelectionChange}
      allLabel={allLabel}
      ariaLabel={ariaLabel}
      className={className}
      isDisabled={isDisabled || projects.length === 0}
    />
  )
}
