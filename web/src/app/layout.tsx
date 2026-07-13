import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { Providers } from './providers'
import AppShell from '@/components/app-shell'
import { getCurrentUser } from '@/core/auth'

export const metadata: Metadata = {
  title: '周报文件系统',
  description: '中大咨询集团周报文件系统',
  icons: { icon: '/favicon.ico' },
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser()
  const cookieStore = await cookies()
  const initialSidebarCollapsed =
    cookieStore.get('iws-sidebar-collapsed')?.value === '1'

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-default-50/40 font-sans text-foreground antialiased dark:bg-background">
        <Providers>
          <AppShell
            initialUser={user}
            initialSidebarCollapsed={initialSidebarCollapsed}
          >
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  )
}
