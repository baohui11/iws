'use client'

/**
 * 经预签名 URL 从 MinIO 直连下载。
 * 须 credentials:'omit'，否则 localhost Cookie 会随请求发到 :9000，触发 MinIO MetadataTooLarge。
 */
export async function downloadProjectFile(fileId: string): Promise<void> {
  const res = await fetch(
    `/api/files/${encodeURIComponent(fileId)}/download?format=json`,
    {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    }
  )

  if (!res.ok) {
    let message = '下载失败'
    try {
      const body = (await res.json()) as { message?: string }
      if (body.message) message = body.message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }

  const { url, fileName } = (await res.json()) as {
    url: string
    fileName: string
  }

  const fileRes = await fetch(url, {
    credentials: 'omit',
    mode: 'cors',
    cache: 'no-store',
  })

  if (!fileRes.ok) {
    throw new Error('从存储拉取文件失败')
  }

  const blob = await fileRes.blob()
  const objectUrl = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = fileName
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
