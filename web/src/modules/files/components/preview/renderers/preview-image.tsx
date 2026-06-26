'use client'

import { Spinner } from '@heroui/react'
import { Icon } from '@iconify/react'
import { useState } from 'react'

export function PreviewImage({ signedUrl }: { signedUrl: string }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div className="relative flex min-h-[70svh] w-full items-center justify-center overflow-auto bg-default-100 p-4">
      {!loaded && !failed ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner label="加载图片" />
        </div>
      ) : null}
      {failed ? (
        <div className="flex flex-col items-center gap-3 text-center text-default-500">
          <Icon icon="lucide:image-off" className="size-12" />
          <p className="text-sm">图片加载失败</p>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- 预览签名 URL
        <img
          src={signedUrl}
          alt=""
          draggable={false}
          className="block h-auto max-h-[calc(100svh-180px)] max-w-full rounded-md border border-default-200 bg-content1 object-contain shadow-sm"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}
