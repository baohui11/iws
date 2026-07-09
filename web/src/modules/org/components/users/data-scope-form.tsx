'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Switch,
  addToast,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import { useRouter } from 'next/navigation'
import DepartmentTreeSelect from '@/modules/org/components/department-tree-select'
import type { DepartmentNode } from '@/modules/org/departments/repo'
import type { UserDataScopeRow, UserWithDepartment } from '@/modules/org/users/repo'
import {
  saveDataScopesAction,
  searchDataScopeUsersAction,
} from '@/modules/org/users/actions'
import { showErrorToast, showResultError } from '@/core/client/errors'
import { randomClientId } from '@/core/random-client-id'

interface ScopeLine {
  key: string
  department_id: string
}

interface DataScopeFormProps {
  users: UserWithDepartment[]
  departments: DepartmentNode[]
  initialUserId?: string
  initialScopes?: UserDataScopeRow[]
  mode: 'create' | 'edit'
}

export default function DataScopeForm({
  users,
  departments,
  initialUserId = '',
  initialScopes = [],
  mode,
}: DataScopeFormProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [userId, setUserId] = useState(initialUserId)
  const [userKeyword, setUserKeyword] = useState('')
  const [userOptionsSource, setUserOptionsSource] = useState(users)
  const [hasAllScope, setHasAllScope] = useState(() =>
    initialScopes.some((scope) => scope.scope_type === 'all')
  )
  const [scopeLines, setScopeLines] = useState<ScopeLine[]>(() =>
    initialScopes
      .filter((scope) => scope.scope_type === 'department' && scope.department_id)
      .map((scope) => ({
        key: scope.id,
        department_id: scope.department_id!,
      }))
  )
  const userOptions = useMemo(
    () =>
      userOptionsSource.map((user) => ({
        key: user.id,
        label: user.name ?? user.email ?? user.id,
        description: [
          user.employee_no ? `工号：${user.employee_no}` : null,
          user.department_name || null,
          user.is_active ? null : '未生效',
        ]
          .filter(Boolean)
          .join(' · '),
        searchText: `${user.name ?? ''} ${user.employee_no ?? ''} ${user.email ?? ''}`,
      })),
    [userOptionsSource]
  )

  useEffect(() => {
    if (mode === 'edit') return
    let canceled = false
    const timer = window.setTimeout(() => {
      setIsSearching(true)
      searchDataScopeUsersAction({
        keyword: userKeyword,
        limit: 50,
      })
        .then((result) => {
          if (!canceled && result.success) {
            setUserOptionsSource(result.data)
          }
        })
        .finally(() => {
          if (!canceled) setIsSearching(false)
        })
    }, 250)

    return () => {
      canceled = true
      window.clearTimeout(timer)
    }
  }, [mode, userKeyword])

  const addScopeLine = () =>
    setScopeLines((prev) => [
      ...prev,
      { key: randomClientId(), department_id: '' },
    ])

  const removeScopeLine = (key: string) =>
    setScopeLines((prev) => prev.filter((line) => line.key !== key))

  const patchScopeLine = (key: string, departmentId: string) =>
    setScopeLines((prev) =>
      prev.map((line) =>
        line.key === key ? { ...line, department_id: departmentId } : line
      )
    )

  const submit = async () => {
    if (!userId || isSaving) return
    setIsSaving(true)
    try {
      const result = await saveDataScopesAction({
        user_id: userId,
        data_scopes: hasAllScope
          ? [{ scope_type: 'all' as const, include_children: true }]
          : scopeLines
              .filter((line) => line.department_id.trim())
              .map((line) => ({
                scope_type: 'department' as const,
                department_id: line.department_id.trim(),
                include_children: true,
              })),
      })
      if (!result.success) {
        showResultError(result, '保存失败')
        return
      }
      addToast({ title: '数据权限已保存', color: 'success', timeout: 2000 })
      router.push('/admin/data-scopes')
    } catch (error) {
      showErrorToast({ title: '保存失败', error })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Autocomplete
        label="用户"
        placeholder="请选择用户"
        allowsCustomValue={false}
        items={userOptions}
        selectedKey={userId || null}
        isDisabled={isSaving || mode === 'edit'}
        isLoading={isSearching}
        variant="underlined"
        onInputChange={setUserKeyword}
        onSelectionChange={(key) => setUserId(key == null ? '' : String(key))}
      >
        {(item) => (
          <AutocompleteItem key={item.key} textValue={item.searchText}>
            <div className="flex flex-col">
              <span>{item.label}</span>
              {item.description ? (
                <span className="text-default-400 text-xs">
                  {item.description}
                </span>
              ) : null}
            </div>
          </AutocompleteItem>
        )}
      </Autocomplete>

      <div className="rounded-medium border border-default-200 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">授权范围</h2>
            <p className="text-default-500 mt-1 text-sm">
              用户所属部门默认生效，这里只维护额外授权部门，授权部门默认包含下级部门。
            </p>
          </div>
          <Switch
            isSelected={hasAllScope}
            onValueChange={setHasAllScope}
            isDisabled={isSaving}
          >
            全公司
          </Switch>
        </div>

        {!hasAllScope ? (
          <div className="space-y-3">
            {scopeLines.length === 0 ? (
              <p className="text-default-500 text-sm">暂无额外授权部门。</p>
            ) : null}
            {scopeLines.map((line) => (
              <div
                key={line.key}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3"
              >
                <DepartmentTreeSelect
                  departments={departments}
                  value={line.department_id}
                  onChange={(id) => patchScopeLine(line.key, id)}
                  label="授权部门"
                  placeholder="请选择部门"
                  emptyOptionLabel="未选择"
                  isDisabled={isSaving}
                  size="md"
                />
                <Button
                  type="button"
                  isIconOnly
                  variant="light"
                  color="danger"
                  aria-label="移除授权部门"
                  onPress={() => removeScopeLine(line.key)}
                  isDisabled={isSaving}
                >
                  <Icon icon="lucide:trash-2" className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="flat"
              startContent={<Icon icon="lucide:plus" className="size-4" aria-hidden />}
              onPress={addScopeLine}
              isDisabled={isSaving}
            >
              添加授权部门
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="flat"
          onPress={() => router.push('/admin/data-scopes')}
          isDisabled={isSaving}
        >
          返回
        </Button>
        <Button
          color="primary"
          onPress={submit}
          isLoading={isSaving}
          isDisabled={!userId}
        >
          保存
        </Button>
      </div>
    </div>
  )
}
