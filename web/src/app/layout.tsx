import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import LayoutNavbar from '@/components/navbar'
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

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <LayoutNavbar initialUser={user} />
            <main className="flex min-h-0 flex-1 flex-col">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
