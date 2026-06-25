'use server'

import { run } from '@/core/result'
import { uploadAvatar } from './service'

export async function uploadAvatarAction(formData: FormData) {
  return run(() => uploadAvatar(formData))
}
