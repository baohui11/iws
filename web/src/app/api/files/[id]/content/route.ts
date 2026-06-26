import type { GetObjectCommandOutput } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUser } from '@/core/auth'
import {
  getProjectFileObjectInternal,
  headProjectFileObjectInternal,
} from '@/core/storage/project-files'
import { canAccessFileBinary } from '@/modules/files/preview/access'
import { getFileRowForPreview } from '@/modules/files/preview/repo'
import {
  normalizeExt,
  resolvePreviewContentType,
} from '@/modules/files/preview/content-type'

export const runtime = 'nodejs'

function parseByteRange(
  rangeHeader: string | null,
  size: number
): { start: number; end: number } | null {
  if (!rangeHeader?.startsWith('bytes=') || size <= 0) return null
  const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader.trim())
  if (!match) return null

  const start = Number(match[1])
  if (!Number.isFinite(start) || start < 0 || start >= size) return null

  const end =
    match[2] !== ''
      ? Math.min(Number(match[2]), size - 1)
      : size - 1
  if (!Number.isFinite(end) || end < start) return null

  return { start, end }
}

function resolveStorageKey(
  row: NonNullable<Awaited<ReturnType<typeof getFileRowForPreview>>>,
  variant: string | null
): string | null {
  if (variant === 'preview') {
    return row.preview_storage_key?.trim() || null
  }
  return row.source_storage_key?.trim() || null
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await ctx.params
  const fileId = rawId?.trim()
  if (!fileId) {
    return NextResponse.json({ message: '文件 ID 无效' }, { status: 400 })
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ message: '请先登录' }, { status: 401 })
  }

  const row = await getFileRowForPreview(fileId)
  if (!row) {
    return NextResponse.json({ message: '文件不存在' }, { status: 404 })
  }

  if (!canAccessFileBinary(user, row)) {
    return NextResponse.json({ message: '无权预览该文件' }, { status: 403 })
  }

  const variant = req.nextUrl.searchParams.get('variant')
  const storageKey = resolveStorageKey(row, variant)
  if (!storageKey) {
    return NextResponse.json({ message: '预览文件不存在' }, { status: 404 })
  }

  const objectInfo = await headProjectFileObjectInternal(storageKey)
  const size = objectInfo?.contentLength ?? null
  if (size == null || size < 0) {
    return NextResponse.json({ message: '无法读取文件' }, { status: 404 })
  }

  const ext = normalizeExt(row.file_ext)
  const contentType = resolvePreviewContentType({
    ext,
    mimeType: row.mime_type,
    variant,
  })

  const range = parseByteRange(req.headers.get('range'), size)

  let objectBody: GetObjectCommandOutput
  try {
    objectBody = await getProjectFileObjectInternal(storageKey, range ?? undefined)
  } catch {
    return NextResponse.json({ message: '读取文件失败' }, { status: 500 })
  }

  const body = objectBody.Body
  if (!body || typeof body.transformToWebStream !== 'function') {
    return NextResponse.json({ message: '读取文件失败' }, { status: 500 })
  }

  const headers = new Headers({
    'Content-Type': contentType,
    'Content-Disposition': 'inline',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
  })

  if (range) {
    const contentRange =
      objectBody.ContentRange ??
      `bytes ${range.start}-${range.end}/${size}`
    headers.set('Content-Range', contentRange)
    headers.set('Content-Length', String(range.end - range.start + 1))
    return new NextResponse(body.transformToWebStream(), {
      status: 206,
      headers,
    })
  }

  headers.set('Content-Length', String(size))
  return new NextResponse(body.transformToWebStream(), {
    status: 200,
    headers,
  })
}
