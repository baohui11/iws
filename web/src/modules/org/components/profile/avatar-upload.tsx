'use client'

import { Avatar, Button } from '@heroui/react'
import { useRouter } from 'next/navigation'
import React from 'react'
import { uploadAvatarAction } from '@/modules/org/profile/actions'
import { resolveAvatarUrl } from '@/core/storage/buckets'
import { AVATAR_ALLOWED_MIME, MAX_AVATAR_BYTES } from '@/core/storage/constants'

interface AvatarUploadProps {
  name: string
  initialSrc: string | null
}

export default function AvatarUpload({ name, initialSrc }: AvatarUploadProps) {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [src, setSrc] = React.useState(() => resolveAvatarUrl(initialSrc) ?? '')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    setSrc(resolveAvatarUrl(initialSrc) ?? '')
  }, [initialSrc])

  const avatarName = name?.charAt(0)?.toUpperCase() ?? ''

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError('')
    if (!AVATAR_ALLOWED_MIME.has(file.type)) {
      setError('仅支持 JPG、PNG、WebP、GIF 图片')
      return
    }
    if (file.size <= 0) {
      setError('文件为空')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('文件大小不能超过 2MB')
      return
    }

    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const result = await uploadAvatarAction(fd)

      if (result.success && result.data?.avatarUrl) {
        setSrc(result.data.avatarUrl)
        window.dispatchEvent(
          new CustomEvent('iws:user-updated', {
            detail: { avatarUrl: result.data.avatarUrl },
          })
        )
        router.refresh()
      } else {
        setError(result.success ? '上传失败' : result.message)
      }
    } catch {
      setError('上传失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          classNames={{ base: 'h-20 w-20', name: 'text-2xl font-semibold' }}
          name={avatarName}
          src={src || undefined}
        />
        <div className="flex flex-col gap-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={loading}
            onChange={onChange}
          />
          <Button
            color="primary"
            isLoading={loading}
            radius="md"
            size="sm"
            variant="flat"
            onPress={() => inputRef.current?.click()}
          >
            更换头像
          </Button>
          <p className="text-default-400 text-xs">
            支持 JPG、PNG、WebP、GIF，最大 2MB
          </p>
          {error ? <p className="text-danger text-sm">{error}</p> : null}
        </div>
      </div>
    </div>
  )
}
