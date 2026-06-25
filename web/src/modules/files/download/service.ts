import { insertFileDownloadRecord } from './repo'

export async function recordFileDownload(input: {
  fileId: string
  userId: string | null
  ipAddress: string | null
}): Promise<void> {
  await insertFileDownloadRecord(input)
}
