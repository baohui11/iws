'use client'

import { useMemo } from 'react'
import SearchableSelect from '@/components/common/searchable-select'
import type { DepartmentNode } from '@/modules/org/departments/repo'

interface DepartmentTreeSelectProps {
  departments: DepartmentNode[]
  value?: string
  onChange?: (value: string, department: DepartmentNode | null) => void
  placeholder?: string
  emptyOptionLabel?: string
  label?: string
  isRequired?: boolean
  isDisabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  errorMessage?: string
  description?: string
  variant?: 'flat' | 'bordered' | 'underlined' | 'faded'
  className?: string
  includeInactive?: boolean
}

function flattenDepartments(
  departments: DepartmentNode[],
  parentName?: string
): Array<{ id: string; name: string; fullName: string; dept: DepartmentNode }> {
  const result: Array<{
    id: string
    name: string
    fullName: string
    dept: DepartmentNode
  }> = []

  for (const dept of departments) {
    const fullName = parentName ? `${parentName} / ${dept.name}` : dept.name
    result.push({ id: dept.id, name: dept.name, fullName, dept })
    if (dept.children && dept.children.length > 0) {
      result.push(...flattenDepartments(dept.children, fullName))
    }
  }
  return result
}

function findDepartment(
  departments: DepartmentNode[],
  id: string
): DepartmentNode | null {
  for (const dept of departments) {
    if (dept.id === id) return dept
    if (dept.children) {
      const child = findDepartment(dept.children, id)
      if (child) return child
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
  includeInactive = false,
}: DepartmentTreeSelectProps) {
  const filteredDepartments = useMemo(() => {
    if (includeInactive) return departments
    const filterActive = (items: DepartmentNode[]): DepartmentNode[] =>
      items
        .map((dept) => ({
          ...dept,
          children: dept.children ? filterActive(dept.children) : [],
        }))
        .filter((dept) => dept.is_active)
    return filterActive(departments)
  }, [departments, includeInactive])

  const options = useMemo(
    () => flattenDepartments(filteredDepartments),
    [filteredDepartments]
  )
  const selectOptions = useMemo(
    () =>
      options.map((option) => ({
        key: option.id,
        label: option.fullName,
        description: option.dept.code ? `(${option.dept.code})` : undefined,
        searchText: `${option.fullName} ${option.name} ${option.dept.code ?? ''}`,
      })),
    [options]
  )

  const handleChange = (selectedId: string) => {
    if (!selectedId) {
      onChange?.('', null)
      return
    }
    const dept = findDepartment(filteredDepartments, selectedId)
    onChange?.(selectedId, dept ?? null)
  }

  return (
    <SearchableSelect
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      options={selectOptions}
      isRequired={isRequired}
      isDisabled={isDisabled}
      size={size}
      errorMessage={errorMessage}
      description={description}
      variant={variant}
      className={className}
      emptyOptionLabel={emptyOptionLabel}
    />
  )
}
