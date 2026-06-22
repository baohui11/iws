'use client'

import { Fragment, useMemo } from 'react'
import { Select, SelectItem } from '@heroui/react'
import type { Selection } from '@heroui/react'
import type { DepartmentNode } from '@/lib/db/admin/departments'

function selectionToId(selection: Selection): string {
  if (selection === 'all') return ''
  return Array.from(selection).map(String)[0] ?? ''
}

/** 列表首项：选中时 onChange 传空字符串（用于筛选「全部」等场景） */
const EMPTY_KEY = '__dept_empty__'

interface DepartmentTreeSelectProps {
  departments: DepartmentNode[]
  value?: string
  onChange?: (value: string, department: DepartmentNode | null) => void
  placeholder?: string
  /** 若设置，会在列表最前增加一项，选中时 value 为空字符串 */
  emptyOptionLabel?: string
  label?: string
  isRequired?: boolean
  isDisabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  errorMessage?: string
  description?: string
  variant?: 'flat' | 'bordered' | 'underlined' | 'faded'
  className?: string
}

// 将部门树扁平化为选项列表
function flattenDepartments(
  departments: DepartmentNode[],
  parentName?: string
): Array<{ id: string; name: string; fullName: string; dept: DepartmentNode }> {
  const result: Array<{ id: string; name: string; fullName: string; dept: DepartmentNode }> = []

  for (const dept of departments) {
    const fullName = parentName ? `${parentName} / ${dept.name}` : dept.name
    result.push({
      id: dept.id,
      name: dept.name,
      fullName,
      dept,
    })

    // 处理子部门（第二层）
    if (dept.children && dept.children.length > 0) {
      for (const child of dept.children) {
        result.push({
          id: child.id,
          name: child.name,
          fullName: `${fullName} / ${child.name}`,
          dept: child,
        })
      }
    }
  }

  return result
}

// 查找部门
function findDepartment(
  departments: DepartmentNode[],
  id: string
): DepartmentNode | null {
  for (const dept of departments) {
    if (dept.id === id) return dept
    if (dept.children) {
      for (const child of dept.children) {
        if (child.id === id) return child
      }
    }
  }
  return null
}

export default function DepartmentTreeSelect({
  departments,
  value,
  onChange,
  placeholder = '请选择部门',
  emptyOptionLabel,
  label,
  isRequired,
  isDisabled,
  size = 'md',
  errorMessage,
  description,
  variant = 'underlined',
  className,
}: DepartmentTreeSelectProps) {
  // 扁平化的部门选项
  const options = useMemo(() => flattenDepartments(departments), [departments])

  const selectedKeys = useMemo((): Selection => {
    if (value) return new Set([value])
    if (emptyOptionLabel) return new Set([EMPTY_KEY])
    return new Set()
  }, [value, emptyOptionLabel])

  const handleSelectionChange = (keys: Selection) => {
    const selectedId = selectionToId(keys)
    if (selectedId === EMPTY_KEY || !selectedId) {
      onChange?.('', null)
      return
    }
    const dept = findDepartment(departments, selectedId)
    onChange?.(selectedId, dept ?? null)
  }

  return (
    <Select
      label={label}
      placeholder={placeholder}
      selectedKeys={selectedKeys}
      onSelectionChange={handleSelectionChange}
      isRequired={isRequired}
      isDisabled={isDisabled}
      size={size}
      errorMessage={errorMessage}
      description={description}
      variant={variant}
      className={className}
      disallowEmptySelection={!!emptyOptionLabel}
    >
      <Fragment>
        {emptyOptionLabel ? (
          <SelectItem key={EMPTY_KEY} textValue={emptyOptionLabel}>
            {emptyOptionLabel}
          </SelectItem>
        ) : null}
        {options.map((option) => (
          <SelectItem key={option.id} textValue={option.fullName}>
            <div className="flex flex-col">
              <span>{option.fullName}</span>
              {option.dept.code && (
                <span className="text-xs text-default-400">({option.dept.code})</span>
              )}
            </div>
          </SelectItem>
        ))}
      </Fragment>
    </Select>
  )
}
