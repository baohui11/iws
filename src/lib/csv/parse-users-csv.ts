/**
 * 简易 CSV 解析（支持引号、UTF-8 BOM）
 * 表头支持英文或中文别名，统一映射为内部字段名。
 */

import type { SystemRoleValue } from '@/constants/system-roles'
import { parseSystemRoleFromImport } from '@/constants/system-roles'

const HEADER_MAP: Record<string, string> = {
  email: 'email',
  邮箱: 'email',
  name: 'name',
  姓名: 'name',
  employee_no: 'employee_no',
  工号: 'employee_no',
  gender: 'gender',
  性别: 'gender',
  department_id: 'department_id',
  部门id: 'department_id',
  department_name: 'department_name',
  部门名称: 'department_name',
  部门名: 'department_name',
  position: 'position',
  职位: 'position',
  role: 'role',
  角色: 'role',
}

function normalizeHeader(cell: string): string {
  const t = cell.trim()
  const lower = t.toLowerCase()
  return HEADER_MAP[lower] ?? HEADER_MAP[t] ?? lower
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  result.push(cur)
  return result
}

export interface ParsedUserRow {
  email: string
  name: string
  employee_no: string
  gender: string
  /** 部门 UUID，与 department_name 二选一或同时提供（id 优先） */
  department_id: string
  /** 部门名称，与系统内部门 name 精确匹配 */
  department_name: string
  position: string
  role: SystemRoleValue
}

export function parseUsersCsv(text: string): ParsedUserRow[] {
  const normalized = text.replace(/^\uFEFF/, '')
  const lines = normalized.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  const rows: ParsedUserRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const map: Record<string, string> = {}
    headers.forEach((h, j) => {
      map[h] = (values[j] ?? '').trim()
    })
    rows.push({
      email: map.email ?? '',
      name: map.name ?? '',
      employee_no: map.employee_no ?? '',
      gender: map.gender ?? '',
      department_id: map.department_id ?? '',
      department_name: map.department_name ?? '',
      position: map.position ?? '',
      role: parseSystemRoleFromImport(map.role ?? '') ?? 'user',
    })
  }

  return rows
}
