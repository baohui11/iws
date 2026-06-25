import type { ProjectStatusValue } from '@/constants/project-status'

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

function makeNormalizer(map: Record<string, string>) {
  return (cell: string) => {
    const t = cell.trim()
    return map[t.toLowerCase()] ?? map[t] ?? t.toLowerCase()
  }
}

function parseRows(
  text: string,
  normalize: (c: string) => string
): Record<string, string>[] {
  const normalized = text.replace(/^\uFEFF/, '')
  const lines = normalized.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0]).map(normalize)
  const out: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const map: Record<string, string> = {}
    headers.forEach((h, j) => {
      map[h] = (values[j] ?? '').trim()
    })
    out.push(map)
  }
  return out
}

// ---- 项目 ----
const PROJECT_HEADER: Record<string, string> = {
  project_no: 'project_no', 项目编号: 'project_no',
  project_name: 'project_name', 项目名称: 'project_name',
  customer_name: 'customer_name', 客户名称: 'customer_name',
  department_id: 'department_id', 部门id: 'department_id',
  department_name: 'department_name', 部门名称: 'department_name',
  fiscal_year: 'fiscal_year', 财年: 'fiscal_year',
  project_status: 'project_status', 项目状态: 'project_status',
  project_stage: 'project_stage', 项目阶段: 'project_stage',
  start_date: 'start_date', 开始日期: 'start_date',
  end_date: 'end_date', 结束日期: 'end_date',
  contract_no: 'contract_no', 合同编号: 'contract_no',
  business_type: 'business_type', 业务类型: 'business_type',
  industry_category: 'industry_category', 行业分类: 'industry_category',
  product_block: 'product_block', 产品板块: 'product_block',
  project_introduction: 'project_introduction', 项目简介: 'project_introduction',
}

const STATUS_SET = new Set(['active', 'preparing', 'completed', 'archived', 'suspended'])

function parseStatus(raw: string): ProjectStatusValue | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null
  if (STATUS_SET.has(t)) return t as ProjectStatusValue
  const zh: Record<string, ProjectStatusValue> = {
    进行中: 'active', 筹备: 'preparing', 已完成: 'completed',
    已归档: 'archived', 已暂停: 'suspended',
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
  const normalize = makeNormalizer(PROJECT_HEADER)
  return parseRows(text, normalize).map((m) => ({
    project_no: m.project_no ?? '',
    project_name: m.project_name ?? '',
    customer_name: m.customer_name ?? '',
    department_id: m.department_id ?? '',
    department_name: m.department_name ?? '',
    fiscal_year: m.fiscal_year ?? '',
    project_status: parseStatus(m.project_status ?? ''),
    project_stage: m.project_stage ?? '',
    start_date: m.start_date ?? '',
    end_date: m.end_date ?? '',
    contract_no: m.contract_no ?? '',
    business_type: m.business_type ?? '',
    industry_category: m.industry_category ?? '',
    product_block: m.product_block ?? '',
    project_introduction: m.project_introduction ?? '',
  }))
}

// ---- 成员 ----
const MEMBER_HEADER: Record<string, string> = {
  project_no: 'project_no', 项目编号: 'project_no',
  employee_no: 'employee_no', 工号: 'employee_no', 用户工号: 'employee_no',
  project_role: 'project_role', 项目角色: 'project_role',
}

export interface ParsedProjectMemberRow {
  project_no: string
  employee_no: string
  project_role: string
}

export function parseProjectMembersCsv(text: string): ParsedProjectMemberRow[] {
  const normalize = makeNormalizer(MEMBER_HEADER)
  return parseRows(text, normalize).map((m) => ({
    project_no: m.project_no ?? '',
    employee_no: m.employee_no ?? '',
    project_role: m.project_role ?? '',
  }))
}

// ---- 成果清单 ----
const DELIVERABLE_HEADER: Record<string, string> = {
  project_no: 'project_no', 项目编号: 'project_no',
  name: 'name', 成果名称: 'name', 成果文件名称: 'name', 名称: 'name',
  description: 'description', 描述: 'description',
}

export interface ParsedProjectDeliverableRow {
  project_no: string
  name: string
  description: string
}

export function parseProjectDeliverablesCsv(
  text: string
): ParsedProjectDeliverableRow[] {
  const normalize = makeNormalizer(DELIVERABLE_HEADER)
  return parseRows(text, normalize).map((m) => ({
    project_no: m.project_no ?? '',
    name: m.name ?? '',
    description: m.description ?? '',
  }))
}
