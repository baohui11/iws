'use client'

import type { ReactNode } from 'react'
import {
  Chip,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
} from '@heroui/react'
import { PROJECT_STATUS_LABEL } from '@/constants/project-status'
import { PROJECT_ROLE_LABEL } from '@/constants/project-roles'
import { useProjectDetail } from '@/components/weekly/project-detail-context'

const STATUS_COLOR: Record<
  string,
  'success' | 'warning' | 'primary' | 'default' | 'danger'
> = {
  active: 'success',
  preparing: 'warning',
  completed: 'primary',
  archived: 'default',
  suspended: 'danger',
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-default-500">{label}</dt>
      <dd className="mt-1.5 text-sm text-foreground">{children}</dd>
    </div>
  )
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = iso.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : iso
}

export default function ProjectInfoTabContent() {
  const { project, departmentLabel } = useProjectDetail()

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">基本信息</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
          <Field label="项目编号">
            <span className="font-mono">{project.project_no ?? '—'}</span>
          </Field>
          <Field label="项目名称">{project.project_name ?? '—'}</Field>
          <Field label="客户名称">{project.customer_name ?? '—'}</Field>
          <Field label="所属部门">{departmentLabel}</Field>
          <Field label="财年">{project.fiscal_year ?? '—'}</Field>
          <Field label="项目状态">
            {project.project_status ? (
              <Chip
                size="sm"
                variant="flat"
                color={STATUS_COLOR[project.project_status] ?? 'default'}
              >
                {PROJECT_STATUS_LABEL[project.project_status] ??
                  project.project_status}
              </Chip>
            ) : (
              '—'
            )}
          </Field>
          <Field label="项目阶段">{project.project_stage ?? '—'}</Field>
          <Field label="开始日期">{formatDate(project.start_date)}</Field>
          <Field label="结束日期">{formatDate(project.end_date)}</Field>
          <Field label="合同编号">
            <span className="font-mono">{project.contract_no ?? '—'}</span>
          </Field>
          <Field label="业务类型">{project.business_type ?? '—'}</Field>
          <Field label="行业分类">{project.industry_category ?? '—'}</Field>
          <Field label="产品板块">{project.product_block ?? '—'}</Field>
          <Field label="项目简介" className="sm:col-span-2">
            <p className="whitespace-pre-wrap text-default-700">
              {project.project_introduction?.trim()
                ? project.project_introduction
                : '—'}
            </p>
          </Field>
        </dl>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">项目成员</h2>
        {project.members.length === 0 ? (
          <p className="text-sm text-default-500">暂无成员</p>
        ) : (
          <Table
            aria-label="项目成员"
            removeWrapper
            classNames={{ wrapper: 'overflow-x-auto' }}
          >
            <TableHeader>
              <TableColumn>姓名</TableColumn>
              <TableColumn>邮箱</TableColumn>
              <TableColumn>项目角色</TableColumn>
            </TableHeader>
            <TableBody>
              {project.members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.user_name ?? '—'}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-default-600">
                    {m.user_email ?? '—'}
                  </TableCell>
                  <TableCell>
                    {m.project_role
                      ? PROJECT_ROLE_LABEL[m.project_role]
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          合同成果清单
        </h2>
        {project.deliverables.length === 0 ? (
          <p className="text-sm text-default-500">暂无成果项</p>
        ) : (
          <Table
            aria-label="合同成果清单"
            removeWrapper
            classNames={{ wrapper: 'overflow-x-auto' }}
          >
            <TableHeader>
              <TableColumn>名称</TableColumn>
              <TableColumn>说明</TableColumn>
            </TableHeader>
            <TableBody>
              {project.deliverables.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="max-w-[360px] text-default-600">
                    {d.description?.trim() ? d.description : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
