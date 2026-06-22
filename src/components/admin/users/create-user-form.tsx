'use client'

import { useState, useTransition, useRef } from 'react'
import { Button, Input, Select, SelectItem, Form, addToast, Checkbox } from '@heroui/react'
import { Icon, addCollection } from '@iconify/react'
import type { Selection } from '@heroui/react'
import solarIcons from '@iconify-json/solar/icons.json'
import { defaultSystemRole, SYSTEM_ROLE_OPTIONS } from '@/constants/system-roles'
import { createUser } from '@/actions/admin/users.action'
import DepartmentTreeSelect from '@/components/admin/department-tree-select'
import type { DepartmentNode } from '@/lib/db/admin/departments'
import { useRouter } from 'next/navigation'

addCollection(solarIcons as Parameters<typeof addCollection>[0])

const GENDER_OPTIONS = [
  { key: '男', label: '男' },
  { key: '女', label: '女' },
]

function selectionToString(selection: Selection): string {
  if (selection === 'all') return ''
  return Array.from(selection).map(String)[0] ?? ''
}

interface CreateUserFormProps {
  departments: DepartmentNode[]
}

export default function CreateUserForm({ departments }: CreateUserFormProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [gender, setGender] = useState<Selection>(new Set([]))
  const [departmentId, setDepartmentId] = useState('')
  const [role, setRole] = useState<Selection>(new Set(['user']))
  const [sendInvite, setSendInvite] = useState(true)

  const resetForm = () => {
    formRef.current?.reset()
    setGender(new Set([]))
    setDepartmentId('')
    setRole(new Set(['user']))
    setSendInvite(true)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createUser({
        employee_no: fd.get('employee_no') as string,
        name: fd.get('name') as string,
        gender: selectionToString(gender),
        department_id: departmentId,
        position: fd.get('position') as string,
        email: fd.get('email') as string,
        role: defaultSystemRole(selectionToString(role)),
        sendInvite,
      })

      if (result.success) {
        const invited = result.data?.invited === true
        addToast({
          title: '创建成功',
          description: invited
            ? `档案已保存，邀请邮件已发送至 ${result.data?.email ?? ''}`
            : '档案已保存。可稍后在用户列表中发送邀请开通登录',
          color: 'success',
          timeout: 3000,
        })
        formRef.current?.reset()
        resetForm()
      } else {
        addToast({
          title: '创建失败',
          description: result.message ?? '操作失败，请稍后重试',
          color: 'danger',
        })
      }
    })
  }

  return (
    <Form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex grid grid-cols-12 flex-col gap-6 py-8 justify-center item-end"
    >
      {/* 第1排：邮箱、角色 */}
      <Input
        className="col-span-12 md:col-span-6"
        isRequired
        name="email"
        label="企业邮箱"
        placeholder="请输入企业邮箱"
        type="email"
        variant="underlined"
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
        isDisabled={isPending}
      />
      <Input
        className="col-span-12 md:col-span-6"
        isRequired
        name="employee_no"
        label="工号"
        placeholder="请输入工号"
        variant="underlined"
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
        <Button
          type="button"
          variant="flat"
          color="default"
          isDisabled={isPending}
          onPress={resetForm}
        >
          重置
        </Button>
        <Button type="submit" color="primary" isLoading={isPending}>
          {isPending ? '创建中...' : '创建用户'}
        </Button>
      </div>
    </Form>
  )
}
