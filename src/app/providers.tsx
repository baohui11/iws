'use client'

import { useEffect } from 'react'
import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

function useDeploymentGuard() {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const msg: string = event.reason?.message ?? ''
      if (
        msg.includes('Failed to find Server Action') ||
        msg.includes('NEXT_DEPLOYMENT') ||
        msg.includes('This request might be from an older')
      ) {
        event.preventDefault()
        window.location.reload()
      }
    }
    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [])
}

export function Providers({ children }: { children: React.ReactNode }) {
  useDeploymentGuard()

  return (
    <HeroUIProvider>
      <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
        <ToastProvider placement="top-right"/>
        {children}
      </NextThemesProvider>
    </HeroUIProvider>
  )
}