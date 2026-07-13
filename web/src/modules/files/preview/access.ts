import type { FileRowPreview } from '../types'
import { resolveFileAccess } from '@/modules/files/access'

/** 是否可读取文件二进制（在线预览、下载）。 */
export async function canAccessFileBinary(
  user: Parameters<typeof resolveFileAccess>[0],
  row: FileRowPreview
): Promise<boolean> {
  const access = await resolveFileAccess(user, {
    id: row.id,
    uploader_id: row.uploader_id,
    project_id: row.project_id,
    project_stage: row.project_stage,
    department_id: row.department_id,
    is_confidential: row.is_confidential,
  })
  return access.canAccessContent
}
