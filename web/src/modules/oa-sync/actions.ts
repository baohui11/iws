'use server'

import { run } from '@/core/result'
import { requireAdmin } from '@/modules/org/guard'
import { listOaSyncRuns } from './repo/sync-log.repo'
import { runLoggedOaSync } from './services/sync-runner'

export async function syncOaDepartmentsAction() {
  return run(async () => {
    await requireAdmin()
    return runLoggedOaSync('departments', 'manual')
  })
}

export async function syncOaUsersAction() {
  return run(async () => {
    await requireAdmin()
    return runLoggedOaSync('users', 'manual')
  })
}

export async function syncOaProjectsAction() {
  return run(async () => {
    await requireAdmin()
    return runLoggedOaSync('projects', 'manual')
  })
}

export async function syncOaProjectRolesAction() {
  return run(async () => {
    await requireAdmin()
    return runLoggedOaSync('project_roles', 'manual')
  })
}

export async function listOaSyncRunsAction(limit?: number) {
  return run(async () => {
    await requireAdmin()
    return listOaSyncRuns(limit)
  })
}
