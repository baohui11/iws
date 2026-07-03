'use server'

import { run } from '@/core/result'
import * as svc from './service'
import type { ProjectListParams } from './repo'
import type { ParsedProjectDeliverableRow } from './csv'

export async function listProjects(params: ProjectListParams) {
  return run(() => svc.listProjects(params))
}

export async function exportProjectsCsv(params: ProjectListParams) {
  return run(() => svc.exportProjectsCsv(params))
}

export async function getProject(id: string) {
  return run(() => svc.getProject(id))
}

export async function saveProjectDeliverables(input: {
  project_id: string
  items: Array<{ id?: string; name: string; description?: string | null }>
}) {
  return run(() => svc.saveProjectDeliverables(input))
}

export async function importProjectDeliverables(
  rows: ParsedProjectDeliverableRow[]
) {
  return run(() => svc.importProjectDeliverables(rows))
}
