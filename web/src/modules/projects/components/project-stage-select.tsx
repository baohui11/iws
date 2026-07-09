'use client'

import { Select, SelectItem } from '@heroui/react'
import {
  PROJECT_STAGE_LABEL,
  PROJECT_STAGE_VALUES,
} from '@/constants/project-stage'

const ALL_STAGE_KEY = '__all__'

const PROJECT_STAGE_FILTER_OPTIONS = [
  { key: ALL_STAGE_KEY, label: '全部阶段' },
  ...PROJECT_STAGE_VALUES.map((value) => ({
    key: value,
    label: PROJECT_STAGE_LABEL[value],
  })),
]

interface ProjectStageSelectProps {
  value: string
  onChange: (value: string) => void
  isDisabled?: boolean
  className?: string
}

export default function ProjectStageSelect({
  value,
  onChange,
  isDisabled,
  className = 'min-w-0',
}: ProjectStageSelectProps) {
  return (
    <Select
      aria-label="项目阶段"
      items={PROJECT_STAGE_FILTER_OPTIONS}
      placeholder="全部阶段"
      size="sm"
      variant="bordered"
      className={className}
      selectedKeys={value ? new Set([value]) : new Set([ALL_STAGE_KEY])}
      onSelectionChange={(keys) => {
        if (keys === 'all') return
        const next = String(Array.from(keys)[0] ?? '')
        onChange(next === ALL_STAGE_KEY ? '' : next)
      }}
      isDisabled={isDisabled}
    >
      {(option) => <SelectItem key={option.key}>{option.label}</SelectItem>}
    </Select>
  )
}
