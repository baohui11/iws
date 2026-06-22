'use client'

import { useEffect } from 'react'

function isDeploymentMismatch(error: Error & { digest?: string }): boolean {
  const msg = error?.message ?? ''
  return (
    msg.includes('Failed to find Server Action') ||
    msg.includes('NEXT_DEPLOYMENT') ||
    msg.includes('This request might be from an older')
  )
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (isDeploymentMismatch(error)) {
      window.location.reload()
    }
  }, [error])

  return (
    <html lang="zh">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f4f4f5' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '32px',
          }}
        >
          <p style={{ fontSize: '18px', fontWeight: 600, color: '#f31260', margin: 0 }}>
            页面发生严重错误
          </p>
          <p style={{ fontSize: '14px', color: '#71717a', margin: 0, textAlign: 'center', maxWidth: '360px' }}>
            {isDeploymentMismatch(error)
              ? '检测到版本更新，正在自动刷新页面…'
              : (error?.message ?? '未知错误，请刷新重试')}
          </p>
          {!isDeploymentMismatch(error) && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                onClick={reset}
                style={{
                  padding: '6px 16px',
                  borderRadius: '8px',
                  border: '1px solid #d4d4d8',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                重试
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '6px 16px',
                  borderRadius: '8px',
                  border: '1px solid #d4d4d8',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                刷新页面
              </button>
            </div>
          )}
        </div>
      </body>
    </html>
  )
}
