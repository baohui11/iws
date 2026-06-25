'use server'

import { run } from '@/core/result'
import * as svc from './service'

export async function loadMemberActiveProjectsForFileUpload() {
  return run(() => svc.loadMemberActiveProjectsForFileUpload())
}

export async function loadFileUploadOptions(projectId: string) {
  return run(() => svc.loadFileUploadOptions(projectId))
}

export async function uploadReferenceFileAction(formData: FormData) {
  return run(() => svc.uploadReferenceFile(formData))
}

export async function uploadDeliverableFileAction(formData: FormData) {
  return run(() => svc.uploadDeliverableFile(formData))
}
