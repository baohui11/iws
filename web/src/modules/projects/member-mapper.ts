import type { ProjectMemberRow } from './types'

export function mapDbProjectMemberToRow(m: {
  id: string
  user_id: string | null
  project_role: string | null
  project_stage?: string | null
  is_active: boolean
  user_name: string | null
  user_email: string | null
  user_department_name?: string | null
}): ProjectMemberRow {
  return {
    id: m.id,
    user_id: m.user_id,
    project_role: m.project_role,
    project_stage: m.project_stage ?? null,
    is_active: m.is_active,
    user_name: m.user_name ?? null,
    user_email: m.user_email ?? null,
    user_department_name: m.user_department_name ?? null,
  }
}
