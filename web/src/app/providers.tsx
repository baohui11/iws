"use client";

import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { GlobalErrorListener } from "@/components/common/global-error-listener";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider>
      <NextThemesProvider attribute="class" defaultTheme="light">
        <GlobalErrorListener />
        {children}
        <ToastProvider placement="top-right" />
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
