import { ValidationError } from '@/core/errors'
import type { OaUserItem, OaUserRow } from '../types'

function requiredText(value: string | null, field: string): string {
  const text = value?.trim()
  if (!text) throw new ValidationError(`OA 用户字段 ${field} 为空`)
  return text
}

function nullableText(value: string | null): string | null {
  const text = value?.trim()
  return text ? text : null
}

function parseLeaveDate(value: string | null): Date | null {
  const text = value?.trim()
  if (!text) return null

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`OA 用户离职日期格式无效: ${text}`)
  }
  return date
}

export function mapOaUserRow(row: OaUserRow): OaUserItem {
  return {
    email: nullableText(row.email),
    name: requiredText(row.employee_name, 'employee_name'),
    employeeNo: requiredText(row.employee_no, 'employee_no'),
    gender: nullableText(row.gender),
    position: nullableText(row.position),
    departmentCode: nullableText(row.dept_no),
    isDeptLeader: row.is_dept_leader === true,
    deletedAt: parseLeaveDate(row.leave_date),
  }
}

export function mapOaUserRows(rows: OaUserRow[]): OaUserItem[] {
  const seen = new Set<string>()
  return rows.map((row) => {
    const item = mapOaUserRow(row)
    if (seen.has(item.employeeNo)) {
      throw new ValidationError(`OA 用户工号重复: ${item.employeeNo}`)
    }
    seen.add(item.employeeNo)
    return item
  })
}
