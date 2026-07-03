import { ValidationError } from '@/core/errors'
import type { OaDepartmentItem, OaDepartmentRow } from '../types'

function requiredText(value: string | null, field: string): string {
  const text = value?.trim()
  if (!text) throw new ValidationError(`OA 部门字段 ${field} 为空`)
  return text
}

function nullableText(value: string | null): string | null {
  const text = value?.trim()
  return text ? text : null
}

function parseLevel(value: string | null): number | null {
  const text = value?.trim()
  if (!text) return null
  const level = Number(text)
  if (!Number.isInteger(level)) {
    throw new ValidationError(`OA 部门层级格式无效: ${value}`)
  }
  return level
}

function parseDeletedAt(row: OaDepartmentRow, syncedAt: Date): Date | null {
  if (row.is_deleted === '0') return null
  if (row.is_deleted !== '1') {
    throw new ValidationError(`OA 部门封存标记无效: ${row.is_deleted ?? ''}`)
  }

  const text = row.deleted_date?.trim()
  if (!text) return syncedAt

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`OA 部门封存时间格式无效: ${text}`)
  }
  return date
}

export function mapOaDepartmentRow(
  row: OaDepartmentRow,
  syncedAt = new Date()
): OaDepartmentItem {
  return {
    code: requiredText(row.department_no, 'department_no'),
    name: requiredText(row.department_name, 'department_name'),
    parentCode: nullableText(row.parent_no),
    level: parseLevel(row.flevel),
    deletedAt: parseDeletedAt(row, syncedAt),
  }
}

export function mapOaDepartmentRows(
  rows: OaDepartmentRow[],
  syncedAt = new Date()
): OaDepartmentItem[] {
  const seen = new Set<string>()
  return rows.map((row) => {
    const item = mapOaDepartmentRow(row, syncedAt)
    if (seen.has(item.code)) {
      throw new ValidationError(`OA 部门编码重复: ${item.code}`)
    }
    seen.add(item.code)
    return item
  })
}
