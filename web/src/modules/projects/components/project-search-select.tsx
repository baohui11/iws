'use client'

import SearchableSelect from '@/components/common/searchable-select'

export interface ProjectSearchSelectOption {
  id: string
  project_no: string | null
  project_name: string | null
  department_name?: string | null
}

interface ProjectSearchSelectProps<T extends ProjectSearchSelectOption> {
  projects: T[]
  value: string
  onChange: (projectId: string, project: T | null) => void
  label?: string
  placeholder?: string
  isDisabled?: boolean
  className?: string
  variant?: 'flat' | 'bordered' | 'underlined' | 'faded'
  size?: 'sm' | 'md' | 'lg'
  emptyOptionLabel?: string
}

function projectLabel(project: ProjectSearchSelectOption): string {
  return project.project_name?.trim() || project.project_no || project.id
}

export default function ProjectSearchSelect<T extends ProjectSearchSelectOption>({
  projects,
  value,
  onChange,
  label = '项目',
  placeholder = '输入项目名称或编号搜索',
  isDisabled,
  className,
  variant = 'bordered',
  size = 'md',
  emptyOptionLabel,
}: ProjectSearchSelectProps<T>) {
  return (
    <SearchableSelect
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(projectId) => {
        onChange(
          projectId,
          projects.find((project) => project.id === projectId) ?? null
        )
      }}
      options={projects.map((project) => {
        const labelText = projectLabel(project)
        const projectNo = project.project_no?.trim() ?? ''
        return {
          key: project.id,
          label: labelText,
          description: projectNo && projectNo !== labelText ? projectNo : undefined,
          searchText: `${project.project_name ?? ''} ${project.project_no ?? ''} ${
            project.department_name ?? ''
          }`,
        }
      })}
      isDisabled={isDisabled}
      variant={variant}
      size={size}
      className={className}
      emptyOptionLabel={emptyOptionLabel}
    />
  )
}
