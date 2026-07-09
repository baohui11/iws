"use client";

import { usePathname } from "next/navigation";
import { Link, cn } from "@heroui/react";

export const weeklyNavItems = [
  {
    label: "工作台",
    href: "/weekly",
    match: (p: string) => p === "/weekly",
  },
  {
    label: "我的项目",
    href: "/weekly/projects",
    match: (p: string) => p.startsWith("/weekly/projects"),
  },
  {
    label: "我的周报",
    href: "/weekly/reports",
    match: (p: string) => p.startsWith("/weekly/reports"),
  },
  {
    label: "我的文件",
    href: "/weekly/files",
    match: (p: string) => p === "/weekly/files" || p.startsWith("/weekly/files/"),
  },
  {
    label: "我的考勤",
    href: "/weekly/attendance",
    match: (p: string) => p.startsWith("/weekly/attendance"),
  },
] as const;

export function WeeklySidebar() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-b border-divider bg-content1/80 backdrop-blur-sm",
        "md:min-h-0 md:w-56 md:self-stretch md:border-b-0 md:border-r"
      )}
    >
      <div className="px-3 py-4 md:sticky md:top-[60px] md:z-20 md:py-6">
        <p className="mb-3 hidden px-2 text-xs font-semibold uppercase tracking-wider text-foreground/40 md:block">
          项目周报
        </p>
        <nav className="flex flex-row gap-1 overflow-x-auto pb-1 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0">
          {weeklyNavItems.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-medium px-3 py-2 text-md font-medium transition-colors md:w-full",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-default-600 hover:bg-default-100 hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
