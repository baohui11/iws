/**
 * 项目 CSV：表头支持英文或中文别名。
 */

import type { ProjectStatusValue } from '@/constants/project-status'

const HEADER_MAP: Record<string, string> = {
  project_no: 'project_no',
  项目编号: 'project_no',
  project_name: 'project_name',
  项目名称: 'project_name',
  customer_name: 'customer_name',
  客户名称: 'customer_name',
  department_id: 'department_id',
  部门id: 'department_id',
  department_name: 'department_name',
  部门名称: 'department_name',
  fiscal_year: 'fiscal_year',
  财年: 'fiscal_year',
  project_status: 'project_status',
  项目状态: 'project_status',
  project_stage: 'project_stage',
  项目阶段: 'project_stage',
  start_date: 'start_date',
  开始日期: 'start_date',
  end_date: 'end_date',
  结束日期: 'end_date',
  contract_no: 'contract_no',
  合同编号: 'contract_no',
  business_type: 'business_type',
  业务类型: 'business_type',
  industry_category: 'industry_category',
  行业分类: 'industry_category',
  product_block: 'product_block',
  产品板块: 'product_block',
  project_introduction: 'project_introduction',
  项目简介: 'project_introduction',
}

const STATUS_SET = new Set<string>([
  'active',
  'preparing',
  'completed',
  'archived',
  'suspended',
])

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

function parseStatus(raw: string): ProjectStatusValue | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null
  if (STATUS_SET.has(t)) return t as ProjectStatusValue
  const zh: Record<string, ProjectStatusValue> = {
    进行中: 'active',
    筹备: 'preparing',
    已完成: 'completed',
    已归档: 'archived',
    已暂停: 'suspended',
  }
  return zh[raw.trim()] ?? null
}

export interface ParsedProjectRow {
  project_no: string
  project_name: string
  customer_name: string
  department_id: string
  department_name: string
  fiscal_year: string
  project_status: ProjectStatusValue | null
  project_stage: string
  start_date: string
  end_date: string
  contract_no: string
  business_type: string
  industry_category: string
  product_block: string
  project_introduction: string
}

export function parseProjectsCsv(text: string): ParsedProjectRow[] {
  const normalized = text.replace(/^\uFEFF/, '')
  const lines = normalized.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  const rows: ParsedProjectRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const map: Record<string, string> = {}
    headers.forEach((h, j) => {
      map[h] = (values[j] ?? '').trim()
    })
    rows.push({
      project_no: map.project_no ?? '',
      project_name: map.project_name ?? '',
      customer_name: map.customer_name ?? '',
      department_id: map.department_id ?? '',
      department_name: map.department_name ?? '',
      fiscal_year: map.fiscal_year ?? '',
      project_status: parseStatus(map.project_status ?? ''),
      project_stage: map.project_stage ?? '',
      start_date: map.start_date ?? '',
      end_date: map.end_date ?? '',
      contract_no: map.contract_no ?? '',
      business_type: map.business_type ?? '',
      industry_category: map.industry_category ?? '',
      product_block: map.product_block ?? '',
      project_introduction: map.project_introduction ?? '',
    })
  }

  return rows
}
