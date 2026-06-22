import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import LayoutNavbar from "@/components/navbar";
import { createClient } from "@/lib/supabase/server";
import { getProfileById, type User } from "@/lib/db/auth/profile";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "周报文件系统",
  description: "中大咨询集团周报文件系统",
  icons: {
    icon: "/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let initialUser: User | null = null
  if (user) {
    const profile = await getProfileById(user.id)
    if (profile) {
      initialUser = { ...profile, email: user.email ?? '' }
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={
          `${geistSans.variable} 
          ${geistMono.variable}
           antialiased
           min-h-screen text-foreground bg-background font-sans`
          }
      >
          <Providers>
            <div className="flex flex-col min-h-screen">
              <LayoutNavbar initialUser={initialUser} />
              <main className="flex min-h-0 flex-1 flex-col">
                {children}
              </main>
            </div>
          </Providers>
      </body>
    </html>
  );
}
