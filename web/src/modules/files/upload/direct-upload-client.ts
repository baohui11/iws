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
      reject(
        new Error(
          parseStorageErrorMessage(xhr.responseText) ??
            `文件直传失败（${xhr.status}）`
        )
      )
    }
    xhr.onerror = () => reject(new Error('文件直传网络异常，请检查网络后重试'))
    xhr.ontimeout = () => reject(new Error('文件直传超时，请稍后重试'))
    xhr.send(params.file)
  })
}

function parseStorageErrorMessage(raw: string | null): string | null {
  if (!raw?.trim()) return null
  try {
    const doc = new DOMParser().parseFromString(raw, 'application/xml')
    const code = doc.querySelector('Code')?.textContent?.trim()
    const message = doc.querySelector('Message')?.textContent?.trim()
    if (message && code) return `${message}（${code}）`
    if (message) return message
  } catch {
    /* ignore */
  }
  return null
}
