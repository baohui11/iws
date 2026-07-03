import { ValidationError } from '@/core/errors'
import { parseProjectStage } from '@/constants/project-stage'
import type { OaProjectRoleItem, OaProjectRoleRow } from '../types'

function requiredText(value: string | null, field: string): string {
  const text = value?.trim()
  if (!text) throw new ValidationError(`OA 项目角色字段 ${field} 为空`)
  return text
}

export function mapOaProjectRoleRow(
  row: OaProjectRoleRow
): OaProjectRoleItem {
  const stageText = requiredText(row.project_statge, 'project_statge')
  const projectStage = parseProjectStage(stageText)
  if (!projectStage) {
    throw new ValidationError(`OA 项目角色阶段无效: ${stageText}`)
  }

  return {
    projectNo: requiredText(row.project_no, 'project_no'),
    employeeNo: requiredText(row.employee_no, 'employee_no'),
    projectRole: requiredText(row.project_role, 'project_role'),
    projectStage,
  }
}

export function mapOaProjectRoleRows(
  rows: OaProjectRoleRow[]
): OaProjectRoleItem[] {
  const seen = new Set<string>()
  return rows.map((row) => {
    const item = mapOaProjectRoleRow(row)
    const key = `${item.projectNo}|${item.employeeNo}|${item.projectRole}`
    if (seen.has(key)) {
      throw new ValidationError(`OA 项目角色重复: ${key}`)
    }
    seen.add(key)
    return item
  })
}
