"use client";

import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Badge, Avatar, Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { signOut } from "@/actions/auth/sign-out";
import type { User } from "@/lib/db";
import { resolveAvatarUrl } from "@/lib/storage/avatar-url";

interface UserMenuProps {
  initialUser: User | null;
}

export default function UserMenu({ initialUser }: UserMenuProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.refresh();
    router.push("/login");
  };

  if (!initialUser) {
    return (
      <Button size="sm" variant="flat" color="secondary"  radius="full" onPress={() => router.push("/login")}>
        未登录
      </Button>
    );
  }

  const avatarName = initialUser.name?.charAt(0)?.toUpperCase() ?? "";

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Button isIconOnly radius="full" variant="light" size="sm" className="overflow-visible">
          <Badge color="success" content="" placement="bottom-right" shape="circle">
            <Avatar
              size="sm"
              src={resolveAvatarUrl(initialUser.avatar_url)}
              name={avatarName}
              classNames={{
                base: "bg-default-100",
                name: "font-semibold text-base",
              }}
            />
          </Badge>
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Profile Actions" variant="flat" className="mt-2 mb-2 gab-4">
        <DropdownItem key="info" className="gap-4" isReadOnly>
          <p className="font-semibold text-base">{initialUser.name}</p>
          <p className="text-xs text-default-400">{initialUser.position}</p>
          <p className="text-xs text-default-400">{initialUser.email}</p>
        </DropdownItem>
        <DropdownItem key="settings" onPress={() => router.push("/profile")}>
          个人设置
        </DropdownItem>
        <DropdownItem key="logout" color="danger" onPress={handleSignOut}>
          登出
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
