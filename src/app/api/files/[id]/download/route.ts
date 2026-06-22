import { NextRequest, NextResponse } from 'next/server'

import { getProfileById } from '@/lib/db/auth/profile'
import { insertFileDownloadRecord } from '@/lib/db/files/file-download'
import { canAccessFileBinary } from '@/lib/db/files/file-preview-access'
import { getFileRowForPreview } from '@/lib/db/files/file-preview'
import { prepareDownloadBuffer } from '@/lib/storage/download-pipeline'
import { getProjectFilesBucket } from '@/lib/storage/project-file-constants'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip')
}

function contentDispositionAttachment(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, '_') || 'download'
  const star = encodeURIComponent(fileName)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${star}`
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

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ message: '请先登录' }, { status: 401 })
  }

  const profile = await getProfileById(user.id)
  if (!profile) {
    return NextResponse.json({ message: '请先登录' }, { status: 401 })
  }

  const row = await getFileRowForPreview(fileId)
  if (!row) {
    return NextResponse.json({ message: '文件不存在' }, { status: 404 })
  }

  if (!canAccessFileBinary(profile, row)) {
    return NextResponse.json({ message: '无权下载该文件' }, { status: 403 })
  }

  const bucket = getProjectFilesBucket()
  const { data: blob, error: dlErr } = await supabase.storage
    .from(bucket)
    .download(row.source_storage_key)

  if (dlErr || !blob) {
    return NextResponse.json(
      { message: dlErr?.message || '读取文件失败' },
      { status: 500 }
    )
  }

  const ab = await blob.arrayBuffer()
  const bytes = new Uint8Array(ab)
  const ext = (row.file_ext || 'bin').replace(/^\./, '')

  let out: Buffer
  try {
    out = await prepareDownloadBuffer(bytes, ext)
  } catch (e) {
    console.error('[file download] prepare failed', e)
    return NextResponse.json({ message: '处理文件失败' }, { status: 500 })
  }

  try {
    await insertFileDownloadRecord({
      fileId,
      userId: profile.id,
      ipAddress: clientIp(req),
    })
  } catch (e) {
    console.error('[file download] record insert failed', e)
    return NextResponse.json({ message: '记录下载失败' }, { status: 500 })
  }

  const mime = row.mime_type?.trim() || 'application/octet-stream'

  return new NextResponse(new Uint8Array(out), {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Disposition': contentDispositionAttachment(
        row.file_name || `file.${ext}`
      ),
      'Content-Length': String(out.length),
      'Cache-Control': 'no-store',
    },
  })
}
