'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError } from '@/lib/errors'

interface SignInInput {
  email: string
  password: string
}

export async function signIn(input: SignInInput) {
  return handleAction(async () => {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    })

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new AuthError('邮箱或密码错误')
      } else if (error.message.includes('Email not confirmed')) {
        throw new AuthError('请先验证邮箱')
      } else {
        throw new AuthError(error.message)
      }
    }
  })
}