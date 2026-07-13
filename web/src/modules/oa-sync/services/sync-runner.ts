import { syncOaDepartments } from './department.service'
import { syncOaProjectRoles } from './project-role.service'
import { syncOaProjects } from './project.service'
import { syncOaUsers } from './user.service'
import {
  completeOaSyncRun,
  createOaSyncRun,
  failOaSyncRun,
} from '../repo/sync-log.repo'
import type {
  OaLoggedSyncResult,
  OaProjectRoleSyncStats,
  OaProjectSyncStats,
  OaSyncScope,
  OaSyncStats,
  OaSyncTrigger,
  OaUserSyncStats,
} from '../types'

function departmentWarningCount(result: OaSyncStats): number {
  return result.missingParents.length
}

function userWarningCount(result: OaUserSyncStats): number {
  return result.missingDepartments.length
}

function projectWarningCount(result: OaProjectSyncStats): number {
  return result.missingDepartments.length
}

function projectRoleWarningCount(result: OaProjectRoleSyncStats): number {
  return result.missingProjects.length + result.missingUsers.length
}

export async function runLoggedOaSync(
  scope: OaSyncScope,
  trigger: OaSyncTrigger
): Promise<OaLoggedSyncResult> {
  const runId = await createOaSyncRun({ scope, trigger })

  try {
    if (scope === 'departments') {
      const result = await syncOaDepartments()
      await completeOaSyncRun(runId, {
        ...result,
        warningCount: result.missingParents.length,
        warnings: result.missingParents,
      })
      return { runId, scope, ...result }
    }

    if (scope === 'users') {
      const result = await syncOaUsers()
      await completeOaSyncRun(runId, {
        ...result,
        warningCount: result.missingDepartments.length,
        warnings: result.missingDepartments,
      })
      return { runId, scope, ...result }
    }

    if (scope === 'projects') {
      const result = await syncOaProjects()
      await completeOaSyncRun(runId, {
        ...result,
        warningCount: result.missingDepartments.length,
        warnings: result.missingDepartments,
      })
      return { runId, scope, ...result }
    }

    const result = await syncOaProjectRoles()
    const warnings = [...result.missingProjects, ...result.missingUsers]
    await completeOaSyncRun(runId, {
      ...result,
      warningCount: warnings.length,
      warnings,
    })
    return { runId, scope, ...result }
  } catch (e) {
    await failOaSyncRun(runId, e)
    throw e
  }
}

export async function runLoggedOaSyncAll(
  trigger: OaSyncTrigger
): Promise<OaLoggedSyncResult[]> {
  return [
    await runLoggedOaSync('departments', trigger),
    await runLoggedOaSync('users', trigger),
    await runLoggedOaSync('projects', trigger),
    await runLoggedOaSync('project_roles', trigger),
  ]
}
