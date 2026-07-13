'use server'

import { run } from '@/core/result'
import {
  changeOwnPassword,
  login,
  logout,
  requestPasswordReset,
  resetPasswordWithToken,
  setOwnPassword,
  verifyPasswordResetToken,
} from './service'
import type {
  ChangePasswordInput,
  LoginInput,
  RequestPasswordResetInput,
  ResetPasswordWithTokenInput,
  SetPasswordInput,
} from './schema'

export async function loginAction(input: LoginInput) {
  return run(() => login(input))
}

export async function logoutAction() {
  return run(() => logout())
}

export async function setPasswordAction(input: SetPasswordInput) {
  return run(() => setOwnPassword(input))
}

export async function changePasswordAction(input: ChangePasswordInput) {
  return run(() => changeOwnPassword(input))
}

export async function requestPasswordResetAction(
  input: RequestPasswordResetInput
) {
  return run(() => requestPasswordReset(input))
}

export async function resetPasswordWithTokenAction(
  input: ResetPasswordWithTokenInput
) {
  return run(() => resetPasswordWithToken(input))
}

export async function verifyPasswordResetTokenAction(input: {
  token: string
  type?: 'invite' | 'password_reset'
}) {
  return run(() => verifyPasswordResetToken(input))
}
