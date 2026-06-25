'use server'

import { run } from '@/core/result'
import * as svc from './service'
import type { UserListParams } from './repo'
import type { CreateUserInput, UpdateUserInput } from './schema'
import type { ImportUserInput } from './service'

export async function listUsers(params: UserListParams) {
  return run(() => svc.listUsers(params))
}

export async function getUser(id: string) {
  return run(() => svc.getUser(id))
}

export async function createUser(input: CreateUserInput) {
  return run(() => svc.createUser(input))
}

export async function updateUser(input: UpdateUserInput) {
  return run(() => svc.updateUser(input))
}

export async function removeUser(id: string) {
  return run(() => svc.removeUser(id))
}

export async function importUsers(rows: ImportUserInput[]) {
  return run(() => svc.importUsers(rows))
}
