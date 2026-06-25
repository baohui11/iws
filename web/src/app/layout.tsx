import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import LayoutNavbar from '@/components/navbar'
import { getCurrentUser } from '@/core/auth'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground min-h-screen font-sans antialiased`}
      >
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
