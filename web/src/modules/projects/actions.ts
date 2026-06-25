'use server'

import { run } from '@/core/result'
import * as svc from './service'
import type { ProjectListParams } from './repo'
import type { SaveProjectInput } from './service'
import type {
  ParsedProjectDeliverableRow,
  ParsedProjectMemberRow,
  ParsedProjectRow,
} from './csv'

export async function listProjects(params: ProjectListParams) {
  return run(() => svc.listProjects(params))
}

export async function getProject(id: string) {
  return run(() => svc.getProject(id))
}

export async function createProject(input: SaveProjectInput) {
  return run(() => svc.createProject(input))
}

export async function updateProject(id: string, input: SaveProjectInput) {
  return run(() => svc.updateProject(id, input))
}

export async function removeProject(id: string) {
  return run(() => svc.removeProject(id))
}

export async function importProjects(rows: ParsedProjectRow[]) {
  return run(() => svc.importProjects(rows))
}

export async function importProjectMembers(rows: ParsedProjectMemberRow[]) {
  return run(() => svc.importProjectMembers(rows))
}

export async function importProjectDeliverables(
  rows: ParsedProjectDeliverableRow[]
) {
  return run(() => svc.importProjectDeliverables(rows))
}
