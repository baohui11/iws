"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { Icon, addCollection } from "@iconify/react";
import solarIcons from "@iconify-json/solar/icons.json";

addCollection(solarIcons as Parameters<typeof addCollection>[0]);

export default function AuthErrorCard() {
  return (
    <div className="rounded-large bg-background/60 shadow-small dark:bg-default-100/50 flex w-full max-w-sm flex-col gap-4 px-8 pt-6 pb-10 backdrop-blur-md backdrop-saturate-150 -mt-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <Icon
          className="text-danger text-5xl"
          icon="solar:danger-circle-bold"
        />
        <h1 className="text-xl font-medium">无法完成验证</h1>
        <p className="text-default-600 text-small leading-relaxed">
          邮件链接可能已过期、已被使用，或地址不完整。请在登录页重新申请重置密码，或联系管理员。
        </p>
      </div>
      <Button
        as={Link}
        className="mt-1 w-full bg-foreground/10 dark:bg-foreground/20"
        href="/login"
      >
        返回登录
      </Button>
    </div>
  );
}
