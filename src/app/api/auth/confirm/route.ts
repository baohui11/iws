// api/auth/confirm/route.ts
import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'
import { resolvePublicOrigin } from '@/lib/utils/resolve-public-origin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/set-password'

  const origin = resolvePublicOrigin(request)

  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = next
  redirectTo.searchParams.delete('token_hash')
  redirectTo.searchParams.delete('type')
  redirectTo.searchParams.delete('next')

  const redirectUrl = new URL(
    redirectTo.pathname + redirectTo.search,
    origin
  )

  if (token_hash && type) {
    const response = NextResponse.redirect(redirectUrl)
    const supabase = createRouteHandlerClient(request, response)

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      return response
    }
  }

  const errUrl = new URL('/error', origin)
  return NextResponse.redirect(errUrl)
}