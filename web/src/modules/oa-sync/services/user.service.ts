import { syncUsersFromOa } from '@/modules/org/users/repo'
import {
  fetchOaPgrestAll,
  type OaPgrestClientOptions,
} from '../adapters/pgrest-client'
import { mapOaUserRows } from '../mappers/user.mapper'
import type { OaUserRow, OaUserSyncStats } from '../types'

const OA_USER_PATH = '/pgrest/to_iws_user_info'

export async function syncOaUsers(
  options: OaPgrestClientOptions = {}
): Promise<OaUserSyncStats> {
  const rows = await fetchOaPgrestAll<OaUserRow>(OA_USER_PATH, options)
  const items = mapOaUserRows(rows)
  return syncUsersFromOa(items)
}
