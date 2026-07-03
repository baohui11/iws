"use client";

import { HeroUIProvider } from "@heroui/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { GlobalErrorListener } from "@/components/common/global-error-listener";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider>
      <NextThemesProvider attribute="class" defaultTheme="light">
        <GlobalErrorListener />
        {children}
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
