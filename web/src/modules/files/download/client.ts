'use client'

import { fetchJsonOrThrow } from '@/core/client/fetch-json'
import { getEncryptGatewayHeaders } from '@/modules/files/lib/encrypt-gateway-client'

/**
 * 经预签名 URL 从 MinIO 直连下载。
 * 须 credentials:'omit'，否则 localhost Cookie 会随请求发到 :9000，触发 MinIO MetadataTooLarge。
 */
export async function downloadProjectFile(fileId: string): Promise<void> {
  const { url, fileName } = await fetchJsonOrThrow<{
    url: string
    fileName: string
  }>(
    `/api/files/${encodeURIComponent(fileId)}/download?format=json`,
    {
      headers: { Accept: 'application/json' },
    }
  )

  const fileRes = await fetch(url, {
    credentials: 'omit',
    mode: 'cors',
    cache: 'no-store',
    headers: getEncryptGatewayHeaders(),
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
