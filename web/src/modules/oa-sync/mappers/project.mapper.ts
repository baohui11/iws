import { ValidationError } from '@/core/errors'
import {
  parseProjectStage,
  type ProjectStageValue,
} from '@/constants/project-stage'
import type { ProjectStatusValue } from '@/constants/project-status'
import type { OaProjectItem, OaProjectRow } from '../types'

function requiredText(value: string | null, field: string): string {
  const text = value?.trim()
  if (!text) throw new ValidationError(`OA 项目字段 ${field} 为空`)
  return text
}

function nullableText(value: string | null): string | null {
  const text = value?.trim()
  return text ? text : null
}

function parseDateText(value: string | null, field: string): string | null {
  const text = nullableText(value)
  if (!text) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new ValidationError(`OA 项目日期字段 ${field} 格式无效: ${text}`)
  }
  return text
}

function parseOaProjectStage(value: string | null): ProjectStageValue | null {
  return parseProjectStage(value)
}

function parseOaProjectStatus(value: string | null): ProjectStatusValue | null {
  const text = value?.trim()
  if (!text) return null
  if (
    text === '进行中' ||
    text === '预结项' ||
    text === '已结项' ||
    text === '终止' ||
    text === '已关闭'
  ) {
    return text
  }
  if (text === '筹备' || text === '准备中') return '进行中'
  if (text === '已完成' || text === '完成') return '已结项'
  if (text === '已归档' || text === '归档') return '已关闭'
  if (text === '已暂停' || text === '暂停' || text === '暂停中') return '终止'
  if (text === 'active' || text === 'preparing') return '进行中'
  if (text === 'completed') return '已结项'
  if (text === 'archived') return '已关闭'
  if (text === 'suspended') return '终止'
  throw new ValidationError(`OA 项目状态无法映射: ${text}`)
}

export function mapOaProjectRow(row: OaProjectRow): OaProjectItem {
  return {
    projectNo: requiredText(row.project_no, 'project_no'),
    projectName: nullableText(row.project_name),
    projectStage: parseOaProjectStage(row.project_stage),
    projectStatus: parseOaProjectStatus(row.project_status),
    departmentCode: nullableText(row.department_no),
    startDate: parseDateText(row.start_date, 'start_date'),
    endDate: parseDateText(row.end_date, 'end_date'),
    projectType: nullableText(row.project_type),
    contractNo: nullableText(row.contract_no),
    fiscalYear: nullableText(row.fiscal_year),
  }
}

export function mapOaProjectRows(rows: OaProjectRow[]): OaProjectItem[] {
  const seen = new Set<string>()
  return rows.map((row) => {
    const item = mapOaProjectRow(row)
    if (seen.has(item.projectNo)) {
      throw new ValidationError(`OA 项目编号重复: ${item.projectNo}`)
    }
    seen.add(item.projectNo)
    return item
  })
}
