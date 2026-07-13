import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUser } from '@/core/auth'
import { createProjectFileSignedUrl } from '@/core/storage/server'
import { recordFileDownload } from '@/modules/files/download/service'
import { canAccessFileBinary } from '@/modules/files/preview/access'
import { getFileRowForPreview } from '@/modules/files/preview/repo'

export const runtime = 'nodejs'

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip')
}

function safeDownloadFileName(fileName: string): string {
  const trimmed = fileName.trim().replace(/[/\\]/g, '_')
  return trimmed || 'download'
}

function wantsJsonResponse(req: NextRequest): boolean {
  if (req.nextUrl.searchParams.get('format') === 'json') return true
  const accept = req.headers.get('accept') ?? ''
  return accept.includes('application/json')
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

  if (!(await canAccessFileBinary(user, row))) {
    return NextResponse.json({ message: '无权下载该文件' }, { status: 403 })
  }

  const ext = (row.file_ext || 'bin').replace(/^\./, '')
  const fileName = safeDownloadFileName(row.file_name || `file.${ext}`)

  try {
    await recordFileDownload({
      fileId,
      userId: user.id,
      ipAddress: clientIp(req),
    })
  } catch (e) {
    console.error('[file download] record insert failed', e)
    return NextResponse.json({ message: '记录下载失败' }, { status: 500 })
  }

  let url: string
  try {
    // 文件名由前端 a.download 使用原始 fileName；预签名 URL 不再带 response-content-disposition
    url = await createProjectFileSignedUrl(row.source_storage_key, 300)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '无法生成下载链接'
    return NextResponse.json({ message: msg || '无法生成下载链接' }, { status: 500 })
  }

  if (wantsJsonResponse(req)) {
    return NextResponse.json(
      { url, fileName },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  return NextResponse.redirect(url, {
    status: 302,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
