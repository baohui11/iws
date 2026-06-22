'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface ForgotPasswordInput {
  email: string
}

export async function forgotPassword(input: ForgotPasswordInput) {
  return handleAction(async () => {
    // 用 admin 接口检查用户是否存在
    const adminClient = await createAdminClient()
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers()

    if (listError) {
      throw new AuthError('服务异常，请稍后重试')
    }

    const exists = users.some(
      (u) => u.email?.toLowerCase() === input.email.trim().toLowerCase()
    )

    if (!exists) {
      throw new AuthError('该邮箱未注册')
    }

    // 用户存在，发送重置邮件
    const supabase = await createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(
      input.email.trim()
    )

    if (error) {
      throw new AuthError('邮件发送失败，请稍后重试')
    }
  })
}
