export type FileProcessStage = 'preview' | 'parse' | 'index' | 'embed'

export type FilePipelineStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'skipped'

export interface FileProcessStatusView {
  stage: FileProcessStage
  status: FilePipelineStatus
  attempts: number
  maxAttempts: number
  errorCode: string | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  updatedAt: string | null
}

export const FILE_PROCESSING_QUEUE = 'file_processing'

export interface FileProcessQueuePayload {
  version: 1
  taskId: string
  fileId: string
  stage: FileProcessStage
}
