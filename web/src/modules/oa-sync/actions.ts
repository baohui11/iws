'use server'

import { run } from '@/core/result'
import { requireUser } from '@/core/auth'
import { AuthError } from '@/core/errors'
import { listOaSyncRuns } from './repo/sync-log.repo'
import { runLoggedOaSync, runLoggedOaSyncAll } from './services/sync-runner'

async function requireSystemAdmin() {
  const user = await requireUser()
  if (user.role !== 'admin') {
    throw new AuthError('只有系统管理员可以执行 OA 同步', 'FORBIDDEN')
  }
  return user
}

export async function syncAllOaDataAction() {
  return run(async () => {
    await requireSystemAdmin()
    return runLoggedOaSyncAll('manual')
  })
}

export async function syncOaDepartmentsAction() {
  return run(async () => {
    await requireSystemAdmin()
    return runLoggedOaSync('departments', 'manual')
  })
}

export async function syncOaUsersAction() {
  return run(async () => {
    await requireSystemAdmin()
    return runLoggedOaSync('users', 'manual')
  })
}

export async function syncOaProjectsAction() {
  return run(async () => {
    await requireSystemAdmin()
    return runLoggedOaSync('projects', 'manual')
  })
}

export async function syncOaProjectRolesAction() {
  return run(async () => {
    await requireSystemAdmin()
    return runLoggedOaSync('project_roles', 'manual')
  })
}

export async function listOaSyncRunsAction(limit?: number) {
  return run(async () => {
    const user = await requireUser()
    if (!canAccessOaSyncLogs(user.role)) {
      throw new AuthError('没有查看 OA 同步记录的权限', 'FORBIDDEN')
    }
    return listOaSyncRuns(limit)
  })
}

function canAccessOaSyncLogs(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'dept_admin'
}
