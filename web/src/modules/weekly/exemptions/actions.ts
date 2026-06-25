'use server'

import { run } from '@/core/result'
import * as svc from './service'

export async function loadPmExemptionsAction() {
  return run(() => svc.listExemptions())
}

export async function loadPmProjectsForExemptionsAction() {
  return run(() => svc.listPmProjects())
}

export async function addPmExemptionAction(input: {
  projectId: string
  weekCode: string
}) {
  return run(() => svc.addExemption(input))
}

export async function removePmExemptionAction(exemptionId: string) {
  return run(() => svc.removeExemption(exemptionId))
}
