'use server'

import { run } from '@/core/result'
import * as svc from './service'
import type {
  BeginDeliverableFileUploadInput,
  BeginReferenceFileUploadInput,
} from './service'

export async function loadMemberActiveProjectsForFileUpload() {
  return run(() => svc.loadMemberActiveProjectsForFileUpload())
}

export async function loadFileUploadOptions(
  projectId: string,
  projectStage: Parameters<typeof svc.loadFileUploadOptions>[1]
) {
  return run(() => svc.loadFileUploadOptions(projectId, projectStage))
}

export async function uploadReferenceFileAction(formData: FormData) {
  return run(() => svc.uploadReferenceFile(formData))
}

export async function uploadDeliverableFileAction(formData: FormData) {
  return run(() => svc.uploadDeliverableFile(formData))
}

export async function beginReferenceFileUploadAction(
  input: BeginReferenceFileUploadInput
) {
  return run(() => svc.beginReferenceFileUpload(input))
}

export async function completeReferenceFileUploadAction(uploadToken: string) {
  return run(() => svc.completeReferenceFileUpload(uploadToken))
}

export async function beginDeliverableFileUploadAction(
  input: BeginDeliverableFileUploadInput
) {
  return run(() => svc.beginDeliverableFileUpload(input))
}

export async function completeDeliverableFileUploadAction(uploadToken: string) {
  return run(() => svc.completeDeliverableFileUpload(uploadToken))
}
