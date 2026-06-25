'use client'

import { Select, SelectItem } from '@heroui/react'
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
    <Select
      placeholder="全部项目"
      selectionMode="multiple"
      size="md"
      variant="bordered"
      className={`min-w-[160px] max-w-[480px] shrink-0 ${className ?? ''}`}
      selectedKeys={selectedKeys}
      onSelectionChange={(keys) => {
        if (keys === 'all') {
          onSelectionChange(new Set())
          return
        }
        onSelectionChange(new Set([...keys].map(String)))
      }}
      isDisabled={isDisabled || projects.length === 0}
      aria-label="项目筛选"
    >
      {projects.map((p) => {
        const label = p.project_name?.trim() || p.project_no || p.id
        const text = `${label}${p.project_no ? `（${p.project_no}）` : ''}`
        return (
          <SelectItem key={p.id} textValue={text}>
            {text}
          </SelectItem>
        )
      })}
    </Select>
  )
}
