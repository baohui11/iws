import { parseProjectRole } from '@/constants/project-roles'
import type { ProjectMemberRow } from '@/types/project'

/** 将 project_members 联表查询结果映射为展示用行（领域解析不在 lib/db） */
export function mapDbProjectMemberToRow(m: {
  id: string
  user_id: string | null
  project_role: string | null
  users: unknown
}): ProjectMemberRow {
  const raw = m.users as unknown
  const u = Array.isArray(raw)
    ? (raw[0] as { name: string | null; email: string | null } | undefined)
    : (raw as { name: string | null; email: string | null } | null)
  return {
    id: m.id,
    user_id: m.user_id,
    project_role: parseProjectRole(m.project_role),
    user_name: u?.name ?? null,
    user_email: u?.email ?? null,
  }
}
