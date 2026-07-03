import { syncProjectsFromOa } from '@/modules/projects/repo'
import {
  fetchOaPgrestAll,
  type OaPgrestClientOptions,
} from '../adapters/pgrest-client'
import { mapOaProjectRows } from '../mappers/project.mapper'
import type { OaProjectRow, OaProjectSyncStats } from '../types'

const OA_PROJECT_PATH = '/pgrest/to_iws_project_info'
const DEFAULT_PROJECT_PAGE_SIZE = 1000

function projectOptions(options: OaPgrestClientOptions): OaPgrestClientOptions {
  return {
    ...options,
    pageSize:
      options.pageSize ??
      Number(
        process.env.OA_PGREST_PROJECT_PAGE_SIZE ??
          process.env.OA_PGREST_PAGE_SIZE ??
          DEFAULT_PROJECT_PAGE_SIZE
      ),
  }
}

export async function syncOaProjects(
  options: OaPgrestClientOptions = {}
): Promise<OaProjectSyncStats> {
  const rows = await fetchOaPgrestAll<OaProjectRow>(
    OA_PROJECT_PATH,
    projectOptions(options)
  )
  const items = mapOaProjectRows(rows)
  return syncProjectsFromOa(items)
}
