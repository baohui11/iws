'use client'

import { useState, useTransition, useRef } from 'react'
import { Button, Input, Select, SelectItem, Form, addToast } from '@heroui/react'
import type { Selection } from '@heroui/react'
import { defaultSystemRole, SYSTEM_ROLE_OPTIONS } from '@/constants/system-roles'
import { createUser } from '@/modules/org/users/actions'
import DepartmentTreeSelect from '@/modules/org/components/department-tree-select'
import type { DepartmentNode } from '@/modules/org/departments/repo'
import { useRouter } from 'next/navigation'

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

  const resetForm = () => {
    formRef.current?.reset()
    setGender(new Set([]))
    setDepartmentId('')
    setRole(new Set(['user']))
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
      })

      if (result.success) {
        addToast({
          title: '创建成功',
          description: '用户档案已保存',
          color: 'success',
          timeout: 3000,
        })
        resetForm()
      } else {
        addToast({
          title: '创建失败',
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
      className="grid grid-cols-12 justify-center gap-6 py-8"
    >
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
      <div className="col-span-12 flex flex-wrap justify-end gap-4">
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
