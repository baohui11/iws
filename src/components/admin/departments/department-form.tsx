'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { Button, Input, Select, SelectItem, Form, addToast } from '@heroui/react'
import type { Selection } from '@heroui/react'
import { useRouter } from 'next/navigation'
import { createDepartment, saveDepartment } from '@/actions/admin/departments.action'
import type { DepartmentWithRelations } from '@/lib/db/admin/departments'

const ROOT_KEY = '__root__'

interface RootOption {
  id: string
  name: string
  code: string
}

interface DepartmentFormProps {
  mode: 'create' | 'edit'
  roots: RootOption[]
  initial?: DepartmentWithRelations
}

function selectionFirst(selection: Selection): string {
  if (selection === 'all') return ''
  return Array.from(selection).map(String)[0] ?? ''
}

export default function DepartmentForm({ mode, roots, initial }: DepartmentFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [parentKey, setParentKey] = useState<Selection>(new Set([ROOT_KEY]))

  useEffect(() => {
    if (!initial) {
      setParentKey(new Set([ROOT_KEY]))
      return
    }
    setParentKey(new Set([initial.parent_id ?? ROOT_KEY]))
  }, [initial])

  const parentItems = useMemo(
    () => [
      { key: ROOT_KEY, label: '（根部门）' },
      ...roots.map((r) => ({ key: r.id, label: `${r.code} · ${r.name}` })),
    ],
    [roots],
  )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const code = (fd.get('code') as string).trim()
    const name = (fd.get('name') as string).trim()
    const parentIdRaw = selectionFirst(parentKey)
    const parent_id = parentIdRaw === ROOT_KEY ? null : parentIdRaw

    startTransition(async () => {
      if (mode === 'create') {
        const result = await createDepartment({
          code,
          name,
          parent_id,
        })
        if (result.success) {
          addToast({ title: '创建成功', color: 'success', timeout: 2000 })
          router.push('/admin/departments')
        } else {
          addToast({ title: '创建失败', description: result.message, color: 'danger' })
        }
        return
      }

      if (!initial) return
      const result = await saveDepartment({
        id: initial.id,
        code,
        name,
        parent_id,
      })
      if (result.success) {
        addToast({ title: '保存成功', color: 'success', timeout: 2000 })
        router.refresh()
      } else {
        addToast({ title: '保存失败', description: result.message, color: 'danger' })
      }
    })
  }

  return (
    <Form onSubmit={handleSubmit} className="flex flex-col gap-6 py-4">
      <div className="grid grid-cols-12 gap-6">
        <Input
          className="col-span-12 md:col-span-6"
          isRequired
          name="code"
          label="部门编码"
          placeholder="唯一编码"
          variant="underlined"
          defaultValue={initial?.code ?? ''}
          isDisabled={isPending}
        />
        <Input
          className="col-span-12 md:col-span-6"
          isRequired
          name="name"
          label="部门名称"
          placeholder="请输入部门名称"
          variant="underlined"
          defaultValue={initial?.name ?? ''}
          isDisabled={isPending}
        />

        <Select
          className="col-span-12 md:col-span-6"
          label="上级部门"
          description="不选则为根部门；子部门只能挂在根部门下"
          variant="underlined"
          items={parentItems}
          selectedKeys={parentKey}
          onSelectionChange={setParentKey}
          isDisabled={isPending}
        >
          {(item) => (
            <SelectItem key={item.key} textValue={item.label}>
              {item.label}
            </SelectItem>
          )}
        </Select>
      </div>

      <div className="flex flex-wrap justify-end gap-4">
        <Button
          type="button"
          variant="flat"
          onPress={() => router.push('/admin/departments')}
          isDisabled={isPending}
        >
          返回列表
        </Button>
        <Button type="submit" color="primary" isLoading={isPending}>
          {mode === 'create' ? (isPending ? '创建中...' : '创建部门') : isPending ? '保存中...' : '保存修改'}
        </Button>
      </div>
    </Form>
  )
}
