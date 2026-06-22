"use client";

import type { NavbarProps } from "@heroui/react";
import React from "react";
import { usePathname } from "next/navigation";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
  Link,
} from "@heroui/react";
import { cn } from "@heroui/react";


import Image from "next/image";
import { ThemeSwitch } from "@/components/navbar/theme-switch";
import Notification from "@/components/navbar/notification";
import UserMenu from "@/components/navbar/user-menu";
import type { User } from "@/lib/db";
import {
  getNavConfigForUser,
  type NavConfig,
} from "@/components/navbar/nav-config";

/** 检查当前路径是否应该激活该导航项 */
function isNavActive(pathname: string, item: NavConfig): boolean {
  if (pathname === item.href) return true;

  if (item.activeOn?.some(path => pathname === path || pathname.startsWith(path + "/"))) {
    return true;
  }

  if (pathname.startsWith(item.href + "/")) {
    return true;
  }

  return false;
}

function isExactMatch(pathname: string, href: string): boolean {
  return pathname === href;
}

interface LayoutNavbarProps extends NavbarProps {
  initialUser?: User | null;
}

export default function LayoutNavbar({ initialUser, ...props }: LayoutNavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const pathname = usePathname();

  const visibleNav = React.useMemo(
    () => getNavConfigForUser(initialUser ?? null),
    [initialUser]
  );

  const activeMainItem = visibleNav.find(item => isNavActive(pathname, item));

  return (
    <Navbar
      {...props}
      isBordered
      position="sticky"
      classNames={{
        base: cn("border-default-100", {
          "bg-default-200/50 dark:bg-default-100/50": isMenuOpen,
        }),
        wrapper: "w-full max-w-full px-2 md:px-20 bg-transparent",
        item: "hidden md:flex",
      }}
      height="60px"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
    >
      <NavbarMenuToggle className="text-default-400 md:hidden" />

      <NavbarBrand className="">
        <Image src="/brand.png" alt="brand" width={36} height={36} className="rounded-full" />
        <span className=" text-lg ml-2 font-bold">周报文件系统</span>
      </NavbarBrand>

      <NavbarContent
        className="border-small border-default-200/20 bg-background/60 shadow-medium dark:bg-default-100/50 hidden h-11 min-w-[min(100%,28rem)] rounded-full px-6 backdrop-blur-md backdrop-saturate-150 md:flex md:min-w-[18rem] md:gap-x-[clamp(1.25rem,3vw,2.75rem)] lg:min-w-[24rem] lg:px-10"
        justify="center"
      >
        {visibleNav.map((item) => {
          const active = isNavActive(pathname, item);

          return (
            <NavbarItem key={item.href} isActive={active} className="flex-shrink-0">
              <Link
                className={cn(
                  "text-md font-medium whitespace-nowrap transition-colors",
                  active ? "text-primary font-bold" : "text-default-500 hover:text-default-700"
                )}
                href={item.href}
              >
                {item.label}
              </Link>
            </NavbarItem>
          );
        })}
      </NavbarContent>
      <NavbarContent justify="end">
        <NavbarItem className="flex! gap-3 items-center">
          <Notification key={initialUser?.id ?? "guest"} userId={initialUser?.id} />
          <UserMenu initialUser={initialUser ?? null} />
          <ThemeSwitch />
        </NavbarItem>
      </NavbarContent>

      <NavbarMenu
        className="bg-default-200/50 shadow-medium dark:bg-default-100/50 top-[calc(var(--navbar-height)-1px)] max-h-[80vh] pt-4 pb-6 backdrop-blur-md backdrop-saturate-150"
      >
        {visibleNav.map((item) => {
          const isParentActive = isNavActive(pathname, item);

          return (
            <div key={item.href} className="mb-2">
              <NavbarMenuItem>
                <Link
                  href={item.href}
                  className={cn(
                    "w-full py-3 text-lg font-medium flex items-center",
                    isParentActive
                      ? "text-primary font-semibold"
                      : "text-default-600"
                  )}
                >
                  {isParentActive && (
                    <span className="mr-3 h-2 w-2 rounded-full bg-primary" />
                  )}
                  {!isParentActive && <span className="mr-3 h-2 w-2" />}
                  {item.label}
                </Link>
              </NavbarMenuItem>

              {item.children && isParentActive && (
                <div className="ml-5 border-l-2 border-default-200 pl-4">
                  {item.children.map((child) => {
                    const isChildActive = isExactMatch(pathname, child.href);

                    return (
                      <NavbarMenuItem key={child.href}>
                        <Link
                          href={child.href}
                          className={cn(
                            "w-full py-2 text-base flex items-center",
                            isChildActive
                              ? "text-primary font-medium"
                              : "text-default-500"
                          )}
                        >
                          {isChildActive && (
                            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                          {!isChildActive && <span className="mr-2 h-1.5 w-1.5" />}
                          {child.label}
                        </Link>
                      </NavbarMenuItem>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </NavbarMenu>
    </Navbar>
  );
}
