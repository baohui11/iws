'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  Chip,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { PROJECT_STATUS_LABEL } from '@/constants/project-status'
import {
  PROJECT_STAGE_IMPLEMENTATION,
  PROJECT_STAGE_LABEL,
  PROJECT_STAGE_SALES,
  type ProjectStageValue,
} from '@/constants/project-stage'
import { useProjectDetail } from '@/modules/weekly/components/projects/project-detail-context'
import {
  updateWeeklyProjectMemberActiveAction,
} from '@/modules/weekly/projects/actions'
import { showResultError } from '@/core/client/errors'
import type { ProjectMemberRow } from '@/modules/projects/types'

const STATUS_COLOR: Record<
  string,
  'success' | 'warning' | 'primary' | 'default' | 'danger'
> = {
  进行中: 'success',
  预结项: 'warning',
  已结项: 'primary',
  终止: 'danger',
  已关闭: 'default',
}

const ROLE_ORDER: Record<ProjectStageValue, string[]> = {
  [PROJECT_STAGE_SALES]: ['销售LD', '销售顾问', '客户经理'],
  [PROJECT_STAGE_IMPLEMENTATION]: [
    '项目实施总监',
    '项目经理',
    '项目成员',
    '兼职',
    '实习生',
  ],
}

interface MemberGroup {
  key: string
  user_name: string | null
  user_department_name: string | null
  stage: ProjectStageValue
  roles: string[]
  member_ids: string[]
  is_active: boolean
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
  if (!iso) return '-'
  const d = iso.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : iso
}

function normalizeRole(role: string | null): string {
  return role?.trim() || '项目成员'
}

function roleRank(stage: ProjectStageValue, role: string): number {
  const order = ROLE_ORDER[stage]
  const idx = order.indexOf(role)
  return idx >= 0 ? idx : order.length + 1
}

function groupMembersByStage(
  members: ProjectMemberRow[],
  memberActiveById: Map<string, boolean>
): Record<ProjectStageValue, MemberGroup[]> {
  const grouped: Record<ProjectStageValue, Map<string, MemberGroup>> = {
    [PROJECT_STAGE_SALES]: new Map(),
    [PROJECT_STAGE_IMPLEMENTATION]: new Map(),
  }

  for (const member of members) {
    if (
      member.project_stage !== PROJECT_STAGE_SALES &&
      member.project_stage !== PROJECT_STAGE_IMPLEMENTATION
    ) {
      continue
    }
    const stage = member.project_stage
    const userKey = member.user_id ?? member.user_email ?? member.id
    const key = `${stage}:${userKey}`
    const role = normalizeRole(member.project_role)
    const existing =
      grouped[stage].get(key) ??
      ({
        key,
        user_name: member.user_name,
        user_department_name: member.user_department_name,
        stage,
        roles: [],
        member_ids: [],
        is_active: false,
      } satisfies MemberGroup)
    if (!existing.roles.includes(role)) existing.roles.push(role)
    existing.member_ids.push(member.id)
    existing.is_active =
      existing.is_active || (memberActiveById.get(member.id) ?? member.is_active)
    grouped[stage].set(key, existing)
  }

  const sortGroups = (stage: ProjectStageValue, groups: MemberGroup[]) =>
    groups
      .map((group) => ({
        ...group,
        roles: group.roles.sort((a, b) => roleRank(stage, a) - roleRank(stage, b)),
      }))
      .sort((a, b) => {
        const roleCmp =
          roleRank(stage, a.roles[0] ?? '') - roleRank(stage, b.roles[0] ?? '')
        if (roleCmp !== 0) return roleCmp
        return (a.user_name ?? '').localeCompare(b.user_name ?? '', 'zh-CN')
      })

  return {
    [PROJECT_STAGE_SALES]: sortGroups(
      PROJECT_STAGE_SALES,
      [...grouped[PROJECT_STAGE_SALES].values()]
    ),
    [PROJECT_STAGE_IMPLEMENTATION]: sortGroups(
      PROJECT_STAGE_IMPLEMENTATION,
      [...grouped[PROJECT_STAGE_IMPLEMENTATION].values()]
    ),
  }
}

function StageMembersTable({
  stage,
  rows,
  canManageProject,
  savingMemberKey,
  onActiveChange,
}: {
  stage: ProjectStageValue
  rows: MemberGroup[]
  canManageProject: boolean
  savingMemberKey: string | null
  onActiveChange: (group: MemberGroup, isActive: boolean) => void
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">
          {PROJECT_STAGE_LABEL[stage]}成员
        </h3>
        <Chip size="sm" variant="flat" color={stage === PROJECT_STAGE_SALES ? 'warning' : 'primary'}>
          {rows.length} 人
        </Chip>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-default-200 py-8 text-center text-sm text-default-500">
          暂无成员
        </p>
      ) : (
        <Table aria-label={`${PROJECT_STAGE_LABEL[stage]}成员`} removeWrapper>
          <TableHeader>
            <TableColumn>姓名</TableColumn>
            <TableColumn>所属部门</TableColumn>
            <TableColumn>角色</TableColumn>
            <TableColumn>是否生效</TableColumn>
          </TableHeader>
          <TableBody>
            {rows.map((group) => (
              <TableRow key={group.key}>
                <TableCell>{group.user_name ?? '-'}</TableCell>
                <TableCell className="max-w-[220px] truncate text-default-600">
                  {group.user_department_name ?? '-'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {group.roles.map((role) => (
                      <Chip key={role} size="sm" variant="flat">
                        {role}
                      </Chip>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {canManageProject ? (
                    <Switch
                      size="sm"
                      isSelected={group.is_active}
                      isDisabled={savingMemberKey === group.key}
                      onValueChange={(value) => onActiveChange(group, value)}
                    >
                      {group.is_active ? '生效' : '不生效'}
                    </Switch>
                  ) : group.is_active ? (
                    '生效'
                  ) : (
                    '不生效'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}

export default function ProjectInfoTabContent({
  projectStage,
}: {
  projectStage: ProjectStageValue
}) {
  const { project, departmentLabel, canManageProject } = useProjectDetail()
  const [memberActiveById, setMemberActiveById] = useState(() =>
    new Map(project.members.map((member) => [member.id, member.is_active]))
  )
  const memberGroups = useMemo(
    () => groupMembersByStage(project.members, memberActiveById),
    [memberActiveById, project.members]
  )
  const [savingMemberKey, setSavingMemberKey] = useState<string | null>(null)

  const updateMemberGroupActive = async (
    group: MemberGroup,
    isActive: boolean
  ) => {
    setSavingMemberKey(group.key)
    const previous = new Map(memberActiveById)
    setMemberActiveById((prev) => {
      const next = new Map(prev)
      for (const id of group.member_ids) next.set(id, isActive)
      return next
    })

    for (const memberId of group.member_ids) {
      const result = await updateWeeklyProjectMemberActiveAction({
        projectId: project.id,
        memberId,
        isActive,
      })
      if (!result.success) {
        setMemberActiveById(previous)
        setSavingMemberKey(null)
        showResultError(result, '保存失败')
        return
      }
    }
    setSavingMemberKey(null)
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">基本信息</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
          <Field label="项目编号">
            <span className="font-mono">{project.project_no ?? '-'}</span>
          </Field>
          <Field label="项目名称">{project.project_name ?? '-'}</Field>
          <Field label="所属部门">{departmentLabel}</Field>
          <Field label="财年">{project.fiscal_year ?? '-'}</Field>
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
              '-'
            )}
          </Field>
          <Field label="项目阶段">{project.project_stage ?? '-'}</Field>
          <Field label="开始日期">{formatDate(project.start_date)}</Field>
          <Field label="结束日期">{formatDate(project.end_date)}</Field>
          <Field label="合同编号">
            <span className="font-mono">{project.contract_no ?? '-'}</span>
          </Field>
          <Field label="项目类型">{project.project_type ?? '-'}</Field>
        </dl>
      </section>

      <StageMembersTable
        stage={projectStage}
        rows={memberGroups[projectStage]}
        canManageProject={canManageProject}
        savingMemberKey={savingMemberKey}
        onActiveChange={(group, value) =>
          void updateMemberGroupActive(group, value)
        }
      />

      {projectStage === PROJECT_STAGE_IMPLEMENTATION ? (
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
                      {d.description?.trim() ? d.description : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      ) : null}
    </div>
  )
}
