import { NextRequest, NextResponse } from 'next/server'
import { AppError } from '@/core/errors'
import { loadFileProcessStatus } from '@/modules/files/processing/service'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const data = await loadFileProcessStatus(id)
    return NextResponse.json(data)
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json(
        { message: e.expose ? e.message : 'Request failed' },
        { status: e.httpStatus }
      )
    }
    console.error('[file process status] failed', e)
    return NextResponse.json({ message: 'Request failed' }, { status: 500 })
  }
}
