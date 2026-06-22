'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { Button, Input, Select, SelectItem, Form, addToast } from '@heroui/react'
import type { Selection } from '@heroui/react'
import { useRouter } from 'next/navigation'
import { defaultSystemRole, SYSTEM_ROLE_OPTIONS } from '@/constants/system-roles'
import { inviteUserById, updateUser } from '@/actions/admin/users.action'
import DepartmentTreeSelect from '@/components/admin/department-tree-select'
import type { DepartmentNode } from '@/lib/db/admin/departments'
import type { UserWithDepartment } from '@/lib/db/admin/user'

const GENDER_OPTIONS = [
  { key: '男', label: '男' },
  { key: '女', label: '女' },
]

function selectionToString(selection: Selection): string {
  if (selection === 'all') return ''
  return Array.from(selection).map(String)[0] ?? ''
}

interface EditUserFormProps {
  user: UserWithDepartment
  departments: DepartmentNode[]
}

export default function EditUserForm({ user, departments }: EditUserFormProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [invitePending, setInvitePending] = useState(false)
  const [gender, setGender] = useState<Selection>(
    () => new Set(user.gender ? [user.gender] : [])
  )
  const [departmentId, setDepartmentId] = useState(user.department_id ?? '')
  const [role, setRole] = useState<Selection>(() => new Set([defaultSystemRole(user.role)]))

  useEffect(() => {
    setGender(new Set(user.gender ? [user.gender] : []))
    setDepartmentId(user.department_id ?? '')
    setRole(new Set([defaultSystemRole(user.role)]))
  }, [user])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await updateUser({
        id: user.id,
        employee_no: fd.get('employee_no') as string,
        name: fd.get('name') as string,
        gender: selectionToString(gender),
        department_id: departmentId,
        position: fd.get('position') as string,
        email: fd.get('email') as string,
        role: defaultSystemRole(selectionToString(role)),
      })

      if (result.success) {
        addToast({
          title: '保存成功',
          description: '用户信息已更新',
          color: 'success',
          timeout: 2000,
        })
        router.refresh()
      } else {
        addToast({
          title: '保存失败',
          description: result.message ?? '操作失败，请稍后重试',
          color: 'danger',
        })
      }
    })
  }

  const handleInvite = () => {
    setInvitePending(true)
    void (async () => {
      const result = await inviteUserById(user.id)
      setInvitePending(false)
      if (result.success) {
        addToast({
          title: '邀请已发送',
          description: '邀请邮件已发送至用户邮箱',
          color: 'success',
          timeout: 2500,
        })
        router.refresh()
      } else {
        addToast({
          title: '发送失败',
          description: result.message ?? '操作失败',
          color: 'danger',
        })
      }
    })()
  }

  return (
    <Form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex grid grid-cols-12 flex-col gap-6 py-8 justify-center item-end"
    >
      {!user.auth_id ? (
        <div className="col-span-12 flex flex-wrap items-center gap-3 rounded-medium border border-warning/30 bg-warning/10 px-4 py-3">
          <span className="text-sm text-foreground/80">
            该用户仅有档案，尚未开通登录。保存邮箱后可发送邀请。
          </span>
          <Button
            type="button"
            color="primary"
            variant="flat"
            size="sm"
            isLoading={invitePending}
            isDisabled={!user.email?.trim()}
            onPress={handleInvite}
          >
            发送邀请
          </Button>
        </div>
      ) : null}
      <Input
        className="col-span-12 md:col-span-6"
        isRequired
        name="email"
        label="企业邮箱"
        placeholder="请输入企业邮箱"
        type="email"
        variant="underlined"
        defaultValue={user.email ?? ''}
        isDisabled={isPending}
      />
      <Select
        className="col-span-12 md:col-span-6"
        label="角色"
        placeholder="请选择角色"
        variant="underlined"
        selectedKeys={role}
        onSelectionChange={setRole}
        isDisabled={isPending}
      >
        {SYSTEM_ROLE_OPTIONS.map((o) => (
          <SelectItem key={o.key}>{o.label}</SelectItem>
        ))}
      </Select>

      <Input
        className="col-span-12 md:col-span-6"
        isRequired
        name="name"
        label="姓名"
        placeholder="请输入姓名"
        variant="underlined"
        defaultValue={user.name ?? ''}
        isDisabled={isPending}
      />
      <Input
        className="col-span-12 md:col-span-6"
        isRequired
        name="employee_no"
        label="工号"
        placeholder="请输入工号"
        variant="underlined"
        defaultValue={user.employee_no ?? ''}
        isDisabled={isPending}
      />
      <Select
        className="col-span-12 md:col-span-6"
        isRequired
        label="性别"
        placeholder="请选择性别"
        variant="underlined"
        selectedKeys={gender}
        onSelectionChange={setGender}
        isDisabled={isPending}
      >
        {GENDER_OPTIONS.map((o) => (
          <SelectItem key={o.key}>{o.label}</SelectItem>
        ))}
      </Select>

      <div className="col-span-12 md:col-span-6">
        <DepartmentTreeSelect
          departments={departments}
          value={departmentId}
          onChange={(id) => setDepartmentId(id)}
          label="部门"
          placeholder="请选择部门"
          isRequired
          isDisabled={isPending}
          size="md"
        />
      </div>

      <Input
        className="col-span-12 md:col-span-6"
        isRequired
        name="position"
        label="职位"
        placeholder="请输入职位"
        variant="underlined"
        defaultValue={user.position ?? ''}
        isDisabled={isPending}
      />

      <div className="flex flex-wrap justify-end gap-4 col-span-12">
        <Button
          type="button"
          variant="flat"
          onPress={() => router.push('/admin/users')}
          isDisabled={isPending}
        >
          返回列表
        </Button>
        <Button type="submit" color="primary" isLoading={isPending}>
          {isPending ? '保存中...' : '保存修改'}
        </Button>
      </div>
    </Form>
  )
}
