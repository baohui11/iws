'use server'

import { run } from '@/core/result'
import { login, logout, setOwnPassword } from './service'
import type { LoginInput, SetPasswordInput } from './schema'

export async function loginAction(input: LoginInput) {
  return run(() => login(input))
}

export async function logoutAction() {
  return run(() => logout())
}

export async function setPasswordAction(input: SetPasswordInput) {
  return run(() => setOwnPassword(input))
}
