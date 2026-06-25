'use client'

import { useState, useTransition, useRef, useMemo } from 'react'
import {
  Button,
  Input,
  Select,
  SelectItem,
  Form,
  Textarea,
  addToast,
} from '@heroui/react'
import type { Selection } from '@heroui/react'
import { Icon, addCollection } from '@iconify/react'
import { useRouter } from 'next/navigation'
import solarIcons from '@iconify-json/solar/icons.json'
import { createProject, updateProject } from '@/modules/projects/actions'
import DepartmentTreeSelect from '@/modules/org/components/department-tree-select'
import type { DepartmentNode } from '@/modules/org/departments/repo'
import type { ProjectDetail } from '@/modules/projects/types'
import {
  PROJECT_STATUS_VALUES,
  PROJECT_STATUS_LABEL,
} from '@/constants/project-status'
import {
  PROJECT_ROLE_LABEL,
  isProjectRoleAllowedForStage,
  parseProjectRole,
  projectRolesForStage,
  type ProjectRoleValue,
} from '@/constants/project-roles'
import {
  PROJECT_STAGE_LABEL,
  PROJECT_STAGE_VALUES,
  parseProjectStage,
} from '@/constants/project-stage'
import { randomClientId } from '@/core/random-client-id'

addCollection(solarIcons as Parameters<typeof addCollection>[0])

function selectionToString(selection: Selection): string {
  if (selection === 'all') return ''
  return Array.from(selection).map(String)[0] ?? ''
}

const STATUS_OPTIONS = PROJECT_STATUS_VALUES.map((v) => ({
  key: v,
  label: PROJECT_STATUS_LABEL[v],
}))

type UserPick = { id: string; name: string | null; email: string | null }

interface MemberLine {
  key: string
  user_id: string
  project_role: ProjectRoleValue | ''
}

interface DeliverableLine {
  key: string
  id?: string
  name: string
  description: string
}

interface ProjectFormProps {
  mode: 'create' | 'edit'
  project?: ProjectDetail | null
  departments: DepartmentNode[]
  users: UserPick[]
}

function dateInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = iso.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ''
}

export default function ProjectForm({
  mode,
  project,
  departments,
  users,
}: ProjectFormProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [departmentId, setDepartmentId] = useState(project?.department_id ?? '')
  const [projectStage, setProjectStage] = useState<string>(
    () => project?.project_stage?.trim() ?? ''
  )
  const [status, setStatus] = useState<Selection>(
    () => new Set(project?.project_status ? [project.project_status] : [])
  )
  const [members, setMembers] = useState<MemberLine[]>(() =>
    project?.members?.length
      ? project.members.map((m) => ({
          key: m.id,
          user_id: m.user_id ?? '',
          project_role: m.project_role ?? '',
        }))
      : []
  )
  const [deliverables, setDeliverables] = useState<DeliverableLine[]>(() =>
    project?.deliverables?.length
      ? project.deliverables.map((d) => ({
          key: d.id,
          id: d.id,
          name: d.name,
          description: d.description ?? '',
        }))
      : []
  )

  const roleOptionsForStage = useMemo(() => {
    return projectRolesForStage(projectStage).map((v) => ({
      key: v,
      label: PROJECT_ROLE_LABEL[v],
    }))
  }, [projectStage])

  const addMember = () =>
    setMembers((prev) => [
      ...prev,
      { key: randomClientId(), user_id: '', project_role: '' },
    ])
  const removeMember = (key: string) =>
    setMembers((prev) => prev.filter((m) => m.key !== key))
  const patchMember = (
    key: string,
    patch: Partial<Pick<MemberLine, 'user_id' | 'project_role'>>
  ) => setMembers((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)))

  const addDeliverable = () =>
    setDeliverables((prev) => [
      ...prev,
      { key: randomClientId(), id: undefined, name: '', description: '' },
    ])
  const removeDeliverable = (key: string) =>
    setDeliverables((prev) => prev.filter((d) => d.key !== key))
  const patchDeliverable = (
    key: string,
    patch: Partial<Pick<DeliverableLine, 'name' | 'description'>>
  ) =>
    setDeliverables((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...patch } : d))
    )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    const stage = parseProjectStage(projectStage)
    const hasMembers = members.some((m) => m.user_id.trim())
    if (hasMembers && !stage) {
      addToast({
        title: '请选择项目阶段',
        description: '已添加成员时须选择实施阶段或销售阶段。',
        color: 'danger',
      })
      return
    }

    for (const m of members) {
      if (!m.user_id.trim()) continue
      const pr = parseProjectRole(m.project_role)
      if (!pr) {
        addToast({
          title: '请选择项目角色',
          description: '已选择用户的成员须指定与阶段匹配的项目角色。',
          color: 'danger',
        })
        return
      }
      if (!isProjectRoleAllowedForStage(projectStage, pr)) {
        addToast({
          title: '角色与项目阶段不匹配',
          description:
            '实施阶段可选：项目经理、项目成员、项目总监；销售阶段可选：项目经理、项目成员、销售LD。',
          color: 'danger',
        })
        return
      }
    }

    const memberPayload = members
      .filter((m) => m.user_id.trim())
      .map((m) => ({
        user_id: m.user_id.trim(),
        project_role: parseProjectRole(m.project_role)!,
      }))

    const deliverablePayload = deliverables
      .filter((d) => d.name.trim())
      .map((d) => ({
        ...(d.id ? { id: d.id } : {}),
        name: d.name.trim(),
        description: d.description.trim() || null,
      }))

    const base = {
      project_no: (fd.get('project_no') as string) ?? '',
      project_name: (fd.get('project_name') as string) || null,
      customer_name: (fd.get('customer_name') as string) || null,
      department_id: departmentId || null,
      fiscal_year: (fd.get('fiscal_year') as string) || null,
      project_status:
        (selectionToString(status) || null) as ProjectDetail['project_status'],
      project_stage: stage ?? null,
      start_date: (fd.get('start_date') as string) || null,
      end_date: (fd.get('end_date') as string) || null,
      contract_no: (fd.get('contract_no') as string) || null,
      business_type: (fd.get('business_type') as string) || null,
      industry_category: (fd.get('industry_category') as string) || null,
      product_block: (fd.get('product_block') as string) || null,
      project_introduction: (fd.get('project_introduction') as string) || null,
      members: memberPayload,
      deliverables: deliverablePayload,
    }

    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createProject(base)
          : await updateProject(project!.id, base)

      if (result.success) {
        addToast({
          title: mode === 'create' ? '创建成功' : '保存成功',
          color: 'success',
          timeout: 2000,
        })
        if (mode === 'create' && result.data?.id) {
          router.replace(`/admin/projects/${result.data.id}`)
        } else {
          router.refresh()
        }
      } else {
        addToast({
          title: mode === 'create' ? '创建失败' : '保存失败',
          description: result.message,
          color: 'danger',
        })
      }
    })
  }

  return (
    <Form
      ref={formRef}
      onSubmit={handleSubmit}
      className="grid grid-cols-12 items-end justify-center gap-6 py-8"
    >
      <div className="col-span-12">
        <h2 className="text-lg font-semibold">基本信息</h2>
      </div>

      <Input className="col-span-12 md:col-span-6" isRequired name="project_no" label="项目编号" placeholder="请输入项目编号" variant="underlined" defaultValue={project?.project_no ?? ''} isDisabled={isPending} />
      <Input className="col-span-12 md:col-span-6" name="project_name" label="项目名称" placeholder="请输入项目名称" variant="underlined" defaultValue={project?.project_name ?? ''} isDisabled={isPending} />
      <Input className="col-span-12 md:col-span-6" name="customer_name" label="客户名称" placeholder="请输入客户名称" variant="underlined" defaultValue={project?.customer_name ?? ''} isDisabled={isPending} />
      <div className="col-span-12 md:col-span-6">
        <DepartmentTreeSelect
          departments={departments}
          value={departmentId}
          onChange={(v) => setDepartmentId(v)}
          emptyOptionLabel="未指定部门"
          label="所属部门"
          placeholder="请选择部门"
          variant="underlined"
          size="md"
        />
      </div>
      <Input className="col-span-12 md:col-span-6" name="fiscal_year" label="财年" placeholder="请输入财年" variant="underlined" defaultValue={project?.fiscal_year ?? ''} isDisabled={isPending} />
      <Select className="col-span-12 md:col-span-6" label="项目状态" placeholder="请选择状态" selectedKeys={status} onSelectionChange={setStatus} variant="underlined" isDisabled={isPending}>
        {STATUS_OPTIONS.map((o) => (
          <SelectItem key={o.key}>{o.label}</SelectItem>
        ))}
      </Select>
      <Select
        className="col-span-12 md:col-span-6"
        label="项目阶段"
        placeholder="请选择阶段"
        selectedKeys={projectStage ? new Set([projectStage]) : new Set()}
        onSelectionChange={(sel) => setProjectStage(selectionToString(sel))}
        variant="underlined"
        isDisabled={isPending}
        description="实施阶段成员角色：项目经理、成员、总监；销售阶段：项目经理、成员、销售LD"
      >
        {PROJECT_STAGE_VALUES.map((v) => (
          <SelectItem key={v}>{PROJECT_STAGE_LABEL[v]}</SelectItem>
        ))}
      </Select>
      <Input className="col-span-12 md:col-span-6" name="start_date" label="开始日期" type="date" variant="underlined" defaultValue={dateInputValue(project?.start_date)} isDisabled={isPending} />
      <Input className="col-span-12 md:col-span-6" name="end_date" label="结束日期" type="date" variant="underlined" defaultValue={dateInputValue(project?.end_date)} isDisabled={isPending} />
      <Input className="col-span-12 md:col-span-6" name="contract_no" label="合同编号" placeholder="请输入合同编号" variant="underlined" defaultValue={project?.contract_no ?? ''} isDisabled={isPending} />
      <Input className="col-span-12 md:col-span-6" name="business_type" label="业务类型" placeholder="请输入业务类型" variant="underlined" defaultValue={project?.business_type ?? ''} isDisabled={isPending} />
      <Input className="col-span-12 md:col-span-6" name="industry_category" label="行业分类" placeholder="请输入行业分类" variant="underlined" defaultValue={project?.industry_category ?? ''} isDisabled={isPending} />
      <Input className="col-span-12 md:col-span-6" name="product_block" label="产品板块" placeholder="请输入产品板块" variant="underlined" defaultValue={project?.product_block ?? ''} isDisabled={isPending} />
      <Textarea className="col-span-12" name="project_introduction" label="项目简介" placeholder="请输入项目简介" variant="underlined" minRows={3} defaultValue={project?.project_introduction ?? ''} isDisabled={isPending} />

      <div className="col-span-12 mt-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">项目成员</h2>
        <Button type="button" size="sm" variant="flat" startContent={<Icon icon="solar:user-plus-linear" />} onPress={addMember} isDisabled={isPending}>
          添加成员
        </Button>
      </div>
      <div className="col-span-12 space-y-4">
        {members.length === 0 && (
          <p className="text-default-500 text-sm">暂无成员，可点击「添加成员」。</p>
        )}
        {members.map((m) => (
          <div key={m.key} className="bg-default-50 flex flex-col gap-4 rounded-lg p-4 md:flex-row md:items-end">
            <Select
              label="用户"
              className="min-w-0 flex-1"
              selectedKeys={m.user_id ? new Set([m.user_id]) : new Set()}
              onSelectionChange={(sel) => patchMember(m.key, { user_id: selectionToString(sel) })}
              variant="underlined"
              isDisabled={isPending}
              placeholder="请选择用户"
            >
              {users.map((u) => (
                <SelectItem key={u.id} textValue={u.name ?? u.email ?? u.id}>
                  {u.name ?? u.email ?? u.id}
                </SelectItem>
              ))}
            </Select>
            <Select
              label="项目角色"
              className="min-w-0 flex-1"
              selectedKeys={m.project_role ? new Set([m.project_role]) : new Set()}
              onSelectionChange={(sel) =>
                patchMember(m.key, {
                  project_role: parseProjectRole(selectionToString(sel)) ?? '',
                })
              }
              variant="underlined"
              isDisabled={isPending}
              placeholder="请选择角色"
            >
              {roleOptionsForStage.map((o) => (
                <SelectItem key={o.key}>{o.label}</SelectItem>
              ))}
            </Select>
            <Button type="button" isIconOnly variant="light" color="danger" className="shrink-0" aria-label="移除" onPress={() => removeMember(m.key)} isDisabled={isPending}>
              <Icon icon="solar:trash-bin-trash-linear" className="text-lg" />
            </Button>
          </div>
        ))}
      </div>

      <div className="col-span-12 mt-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">合同成果清单</h2>
        <Button type="button" size="sm" variant="flat" startContent={<Icon icon="solar:document-add-linear" />} onPress={addDeliverable} isDisabled={isPending}>
          添加成果项
        </Button>
      </div>
      <div className="col-span-12 space-y-4">
        {deliverables.length === 0 && (
          <p className="text-default-500 text-sm">暂无成果项。</p>
        )}
        {deliverables.map((d) => (
          <div key={d.key} className="bg-default-50 grid grid-cols-1 gap-4 rounded-lg p-4 md:grid-cols-12 md:items-end">
            <Input className="md:col-span-5" label="名称" placeholder="成果名称" value={d.name} onValueChange={(v) => patchDeliverable(d.key, { name: v })} variant="underlined" isRequired isDisabled={isPending} />
            <Input className="md:col-span-6" label="说明" placeholder="可选说明" value={d.description} onValueChange={(v) => patchDeliverable(d.key, { description: v })} variant="underlined" isDisabled={isPending} />
            <div className="flex items-end justify-end md:col-span-1">
              <Button type="button" isIconOnly variant="light" color="danger" aria-label="移除" onPress={() => removeDeliverable(d.key)} isDisabled={isPending}>
                <Icon icon="solar:trash-bin-trash-linear" className="text-lg" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="col-span-12 flex flex-wrap justify-end gap-4">
        <Button type="button" variant="flat" onPress={() => router.back()} isDisabled={isPending}>
          返回列表
        </Button>
        <Button type="submit" color="primary" isLoading={isPending}>
          {mode === 'create'
            ? isPending
              ? '创建中...'
              : '创建项目'
            : isPending
              ? '保存中...'
              : '保存修改'}
        </Button>
      </div>
    </Form>
  )
}
