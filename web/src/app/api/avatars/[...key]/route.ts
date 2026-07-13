import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/core/auth'
import { getAvatarBucket } from '@/core/storage/buckets'
import { storage } from '@/core/storage/server'

export const runtime = 'nodejs'

function resolveImageContentType(key: string, storedType: string | null): string {
  if (storedType?.startsWith('image/')) return storedType

  const ext = key.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    default:
      return 'application/octet-stream'
  }
}

function normalizeKey(segments: string[] | undefined): string | null {
  const key = segments
    ?.map((seg) => seg.trim())
    .filter(Boolean)
    .join('/')
  if (!key || key.includes('..')) return null
  return key
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ key?: string[] }> }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ message: '请先登录' }, { status: 401 })
  }

  const params = await ctx.params
  const key = normalizeKey(params.key)
  if (!key) {
    return NextResponse.json({ message: '头像地址无效' }, { status: 400 })
  }

  const bucket = getAvatarBucket()
  const info = await storage.head({ bucket, key })
  if (!info) {
    return NextResponse.json({ message: '头像不存在' }, { status: 404 })
  }

  const body = await storage.get({ bucket, key })
  const bytes = new Uint8Array(body.byteLength)
  bytes.set(body)
  return new NextResponse(bytes.buffer, {
    status: 200,
    headers: {
      'Content-Type': resolveImageContentType(key, info.contentType),
      'Content-Length':
        info.contentLength == null ? String(body.byteLength) : String(info.contentLength),
      'Cache-Control': 'private, max-age=86400',
    },
  })
}
