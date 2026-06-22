'use server'

import { handleAction } from '@/lib/action-handler'

export async function signOut() {
  return handleAction(async () => {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await supabase.auth.signOut()
  })
}