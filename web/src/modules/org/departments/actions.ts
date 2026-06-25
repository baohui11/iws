'use server'

import { run } from '@/core/result'
import * as svc from './service'
import type { DepartmentListParams } from './repo'
import type { CreateDepartmentInput, UpdateDepartmentInput } from './schema'

export async function listDepartments(params: DepartmentListParams) {
  return run(() => svc.listDepartments(params))
}

export async function getDepartment(id: string) {
  return run(() => svc.getDepartment(id))
}

export async function createDepartment(input: CreateDepartmentInput) {
  return run(() => svc.createDepartment(input))
}

export async function saveDepartment(input: UpdateDepartmentInput) {
  return run(() => svc.saveDepartment(input))
}

export async function removeDepartment(id: string) {
  return run(() => svc.removeDepartment(id))
}
