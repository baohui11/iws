'use server'

import { revalidatePath } from 'next/cache'
import { run } from '@/core/result'
import * as svc from './service'
import type { UserListParams } from './repo'
import type { SystemRoleValue } from '@/constants/system-roles'

export async function listUsers(params: UserListParams) {
  return run(() => svc.listUsers(params))
}

export async function exportUsersCsv(params: UserListParams) {
  return run(() => svc.exportUsersCsv(params))
}

export async function getUserForAdmin(id: string) {
  return run(() => svc.getUserForAdmin(id))
}

export async function updateUserActive(input: { id: string; is_active: boolean }) {
  const result = await run(() => svc.updateUserActive(input))
  if (result.success) {
    revalidatePath('/admin/users')
  }
  return result
}

export async function updateUserRole(input: { id: string; role: SystemRoleValue }) {
  const result = await run(() => svc.updateUserRole(input))
  if (result.success) {
    revalidatePath('/admin/users')
  }
  return result
}

export async function updateUserTags(input: { id: string; tags: string | null }) {
  const result = await run(() => svc.updateUserTags(input))
  if (result.success) {
    revalidatePath('/admin/users')
  }
  return result
}

export async function updateUserAdminSettings(input: {
  id: string
  role: SystemRoleValue
  tags: string | null
  is_active: boolean
}) {
  const result = await run(() => svc.updateUserAdminSettings(input))
  if (result.success) {
    revalidatePath('/admin/users')
    revalidatePath(`/admin/users/${input.id}`)
  }
  return result
}

export async function listDataScopesAction() {
  return run(() => svc.listDataScopes())
}

export async function searchDataScopeUsersAction(input: {
  keyword?: string
  limit?: number
}) {
  return run(() => svc.searchDataScopeUsers(input))
}

export async function saveDataScopesAction(input: {
  user_id: string
  data_scopes: Array<{
    scope_type: 'department' | 'all'
    department_id?: string | null
    include_children?: boolean
  }>
}) {
  const result = await run(() => svc.saveDataScopes(input))
  if (result.success) {
    revalidatePath('/admin/data-scopes')
    revalidatePath(`/admin/data-scopes/${input.user_id}`)
  }
  return result
}
