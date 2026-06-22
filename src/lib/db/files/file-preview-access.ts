import type { User } from '@/lib/db/auth/profile'
import type { FileRowPreview } from '@/lib/db/files/file-preview'

/** 可预览/下载敏感文件（is_confidential）的系统角色 */
const CONFIDENTIAL_ACCESS_ROLES = new Set<string>([
  'admin',
  'dept_admin',
  'dept_ld',
])

/**
 * 是否可读取文件二进制（在线预览、下载）。
 * - 非敏感：任意登录用户
 * - 敏感：上传者，或 admin / dept_admin / dept_ld
 */
export function canAccessFileBinary(user: User, row: FileRowPreview): boolean {
  if (!row.is_confidential) return true
  if (user.id === row.uploader_id) return true
  const role = user.role
  if (role && CONFIDENTIAL_ACCESS_ROLES.has(role)) return true
  return false
}
