'use client'

import { Chip } from '@heroui/react'
import { PROJECT_STATUS_LABEL } from '@/constants/project-status'
import type { ProjectStatusValue } from '@/constants/project-status'

const STATUS_COLOR: Record<
  ProjectStatusValue,
  'success' | 'warning' | 'primary' | 'danger' | 'default'
> = {
  进行中: 'success',
  预结项: 'warning',
  已结项: 'primary',
  终止: 'danger',
  已关闭: 'default',
}

export default function ProjectStatusChip({
  value,
}: {
  value: ProjectStatusValue
}) {
  return (
    <Chip size="sm" variant="flat" color={STATUS_COLOR[value]}>
      {PROJECT_STATUS_LABEL[value] ?? value}
    </Chip>
  )
}
