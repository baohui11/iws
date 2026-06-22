"use client";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
  Badge,
} from "@heroui/react";
import { Icon } from "@iconify/react";

import NotificationsPanel from "@/components/navbar/notifications-panel";
import { useNotifications } from "@/hooks/use-notifications";

interface NotificationProps {
  userId: string | null | undefined;
}

export default function Notification({ userId }: NotificationProps) {
  const uid = userId ?? null;
  const { items, unreadCount, loading, markRead, markAllRead } =
    useNotifications(uid);

  if (!uid) {
    return (
      <Button
        isIconOnly
        radius="full"
        variant="flat"
        size="sm"
        isDisabled
        className="opacity-40"
        aria-label="通知（请先登录）"
      >
        <Icon className="text-default-500" icon="solar:bell-linear" width={24} />
      </Button>
    );
  }

  return (
    <Popover offset={4} placement="bottom-end">
      <PopoverTrigger>
        <Button
          disableRipple
          isIconOnly
          className="overflow-visible"
          radius="full"
          variant="flat"
          size="sm"
          aria-label="通知"
        >
          <Badge
            color="danger"
            content={unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : 0}
            showOutline={false}
            size="md"
            isInvisible={unreadCount === 0}
          >
            <Icon className="text-default-500" icon="solar:bell-linear" width={24} />
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-w-[90vw] p-0 sm:max-w-[380px]">
        <NotificationsPanel
          className="w-full shadow-none"
          items={items}
          unreadCount={unreadCount}
          loading={loading}
          onMarkRead={(id) => void markRead(id)}
          onMarkAllRead={() => void markAllRead()}
        />
      </PopoverContent>
    </Popover>
  );
}
