'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError, ValidationError } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'

interface SetPasswordInput {
  password: string
  confirmPassword: string
}

export async function setPassword(input: SetPasswordInput) {
  return handleAction(async () => {
    if (!input.password || !input.confirmPassword) {
      throw new ValidationError('请输入密码和确认密码')
    }

    if (input.password.length < 8) {
      throw new ValidationError('密码长度不能少于 8 位')
    }

    if (input.password !== input.confirmPassword) {
      throw new ValidationError('两次输入的密码不一致')
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new AuthError(
        '登录已失效，请从邮件中的链接重新进入后再设置密码',
      )
    }

    const { error } = await supabase.auth.updateUser({
      password: input.password,
    })

    if (error?.code === 'same_password') {
      throw new ValidationError('新密码不能与旧密码相同')
    }
    if (error) {
      console.warn('[setPassword] updateUser', error.message, error.code)
      throw new AuthError('密码设置失败，请重试')
    }
  })
}
