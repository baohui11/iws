'use client'

import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { GlobalErrorListener } from '@/components/common/global-error-listener'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <HeroUIProvider>
        <GlobalErrorListener />
        {children}
        <ToastProvider placement="top-right" />
      </HeroUIProvider>
    </NextThemesProvider>
  )
}
