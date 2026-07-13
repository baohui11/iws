'use client'

export function getEncryptGatewayHeaders(): Record<string, string> {
  const appId = process.env.NEXT_PUBLIC_ENCRYPT_GATEWAY_APP_ID?.trim()
  return appId ? { 'X-Encrypt-App': appId } : {}
}
