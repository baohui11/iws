import { syncProjectRolesFromOa } from '@/modules/projects/repo'
import {
  fetchOaPgrestAll,
  type OaPgrestClientOptions,
} from '../adapters/pgrest-client'
import { mapOaProjectRoleRows } from '../mappers/project-role.mapper'
import type { OaProjectRoleRow, OaProjectRoleSyncStats } from '../types'

const OA_PROJECT_ROLE_PATH = '/pgrest/to_iws_project_role_info'
const DEFAULT_PROJECT_ROLE_PAGE_SIZE = 1000

function projectRoleOptions(
  options: OaPgrestClientOptions
): OaPgrestClientOptions {
  return {
    ...options,
    pageSize:
      options.pageSize ??
      Number(
        process.env.OA_PGREST_PROJECT_ROLE_PAGE_SIZE ??
          process.env.OA_PGREST_PAGE_SIZE ??
          DEFAULT_PROJECT_ROLE_PAGE_SIZE
      ),
  }
}

export async function syncOaProjectRoles(
  options: OaPgrestClientOptions = {}
): Promise<OaProjectRoleSyncStats> {
  const rows = await fetchOaPgrestAll<OaProjectRoleRow>(
    OA_PROJECT_ROLE_PATH,
    projectRoleOptions(options)
  )
  const items = mapOaProjectRoleRows(rows)
  return syncProjectRolesFromOa(items)
}
