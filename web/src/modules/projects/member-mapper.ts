import { parseProjectRole } from '@/constants/project-roles'
import type { ProjectMemberRow } from './types'

export function mapDbProjectMemberToRow(m: {
  id: string
  user_id: string | null
  project_role: string | null
  user_name: string | null
  user_email: string | null
}): ProjectMemberRow {
  return {
    id: m.id,
    user_id: m.user_id,
    project_role: parseProjectRole(m.project_role),
    user_name: m.user_name ?? null,
    user_email: m.user_email ?? null,
  }
}
