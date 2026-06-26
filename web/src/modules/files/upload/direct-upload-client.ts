'use client'

export function uploadFileToSignedUrl(params: {
  file: File
  uploadUrl: string
  onProgress?: (percent: number) => void
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', params.uploadUrl)
    xhr.setRequestHeader(
      'Content-Type',
      params.file.type || 'application/octet-stream'
    )

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      params.onProgress?.(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        params.onProgress?.(100)
        resolve()
        return
      }
      reject(new Error(`S3 upload failed: ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('S3 upload network error'))
    xhr.ontimeout = () => reject(new Error('S3 upload timed out'))
    xhr.send(params.file)
  })
}
