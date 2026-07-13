function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export function getAppBaseUrl(): string {
  const explicit =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim()
  if (explicit) return trimTrailingSlash(explicit)

  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) return `https://${trimTrailingSlash(vercelUrl)}`

  return 'http://localhost:3000'
}

export function buildPasswordTokenUrl(input: {
  token: string
  type: 'invite' | 'password_reset'
}): string {
  const url = new URL('/reset-password', getAppBaseUrl())
  url.searchParams.set('token', input.token)
  url.searchParams.set('type', input.type)
  return url.toString()
}
