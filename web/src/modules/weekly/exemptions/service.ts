import { requireUser } from '@/core/auth'
import { BusinessError } from '@/core/errors'
import {
  deletePmProjectWeekExemption,
  getPmProjectsForExemptions,
  insertPmProjectWeekExemption,
  listPmProjectWeekExemptions,
} from './repo'

export async function listExemptions() {
  const user = await requireUser()
  return listPmProjectWeekExemptions(user.id)
}

export async function listPmProjects() {
  const user = await requireUser()
  return getPmProjectsForExemptions(user.id)
}

export async function addExemption(input: { projectId: string; weekCode: string }) {
  const user = await requireUser()
  await insertPmProjectWeekExemption({
    userId: user.id,
    projectId: input.projectId,
    weekCode: input.weekCode,
  })
}

export async function removeExemption(exemptionId: string) {
  const user = await requireUser()
  try {
    await deletePmProjectWeekExemption(user.id, exemptionId)
  } catch (e) {
    if (e instanceof BusinessError) throw e
    throw e
  }
}
