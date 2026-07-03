import { syncOaDepartments } from './department.service'
import { syncOaProjectRoles } from './project-role.service'
import { syncOaProjects } from './project.service'
import { syncOaUsers } from './user.service'
import {
  completeOaSyncRun,
  createOaSyncRun,
  failOaSyncRun,
} from '../repo/sync-log.repo'
import type { OaLoggedSyncResult, OaSyncScope, OaSyncTrigger } from '../types'

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
