'use client'

import { Input, Select, SelectItem } from '@heroui/react'
import { Icon } from '@iconify/react'
import DepartmentTreeSelect from '@/modules/org/components/department-tree-select'
import type { DepartmentNode } from '@/modules/org/departments/repo'
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_VALUES,
} from '@/constants/project-status'
import ProjectStageSelect from '@/modules/projects/components/project-stage-select'

interface ProjectListFiltersProps {
  departments: DepartmentNode[]
  departmentId: string
  keyword: string
  projectStage: string
  projectStatus: string
  isDisabled?: boolean
  onDepartmentChange: (departmentId: string) => void
  onKeywordChange: (keyword: string) => void
  onKeywordSubmit?: () => void
  onProjectStageChange: (projectStage: string) => void
  onProjectStatusChange: (projectStatus: string) => void
  className?: string
}

export default function ProjectListFilters({
  departments,
  departmentId,
  keyword,
  projectStage,
  projectStatus,
  isDisabled,
  onDepartmentChange,
  onKeywordChange,
  onKeywordSubmit,
  onProjectStageChange,
  onProjectStatusChange,
  className = '',
}: ProjectListFiltersProps) {
  return (
    <div
      className={`grid min-w-0 grid-cols-1 items-center gap-2 md:grid-cols-[minmax(220px,1fr)_180px_140px_140px] ${className}`}
    >
      <Input
        placeholder="编号、名称、合同号"
        value={keyword}
        onChange={(event) => onKeywordChange(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && onKeywordSubmit?.()}
        variant="bordered"
        startContent={
          <Icon
            icon="lucide:search"
            className="size-4 text-default-400"
            aria-hidden
          />
        }
        size="sm"
        className="min-w-0"
      />

      <DepartmentTreeSelect
        departments={departments}
        value={departmentId}
        onChange={(id) => onDepartmentChange(id)}
        placeholder="全部部门"
        emptyOptionLabel="全部部门"
        variant="bordered"
        size="sm"
        isDisabled={isDisabled}
        className="min-w-0"
      />

      <ProjectStageSelect
        value={projectStage}
        onChange={onProjectStageChange}
        isDisabled={isDisabled}
      />

      <Select
        aria-label="项目状态"
        placeholder="全部状态"
        size="sm"
        variant="bordered"
        className="min-w-0"
        selectedKeys={projectStatus ? new Set([projectStatus]) : new Set(['__all__'])}
        onSelectionChange={(keys) => {
          if (keys === 'all') return
          const next = String(Array.from(keys)[0] ?? '')
          onProjectStatusChange(next === '__all__' ? '' : next)
        }}
        isDisabled={isDisabled}
      >
        {[
          { key: '__all__', label: '全部状态' },
          ...PROJECT_STATUS_VALUES.map((value) => ({
            key: value,
            label: PROJECT_STATUS_LABEL[value],
          })),
        ].map((option) => (
          <SelectItem key={option.key}>{option.label}</SelectItem>
        ))}
      </Select>
    </div>
  )
}
