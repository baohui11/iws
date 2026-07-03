'use server'

import { run } from '@/core/result'
import * as svc from './service'
import type { DepartmentListParams } from './repo'

export async function listDepartments(params: DepartmentListParams) {
  return run(() => svc.listDepartments(params))
}

export async function updateDepartmentActive(input: {
  id: string
  is_active: boolean
}) {
  return run(() => svc.updateDepartmentActive(input))
}
