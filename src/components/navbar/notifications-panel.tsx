"use client";

import type { CardProps } from "@heroui/react";
import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  ScrollShadow,
  Spinner,
  Tabs,
  Tab,
} from "@heroui/react";
import type { ChipProps } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  NOTIFICATION_FILE_FALLBACK_ICON,
  NOTIFICATION_SYSTEM_TYPE_ICONS,
  notificationTypeLabel,
} from "@/constants/notification-types";
import type { NotificationTypeValue } from "@/constants/notification-types";
import { formatRelativeTimePast } from "@/lib/utils/format-relative-time";
import type { NotificationListItem } from "@/lib/db/notifications";
import { parseNotificationUrlFromMeta } from "@/lib/mappers/notification-url";
import { cn } from "@heroui/react";
import { resolveAvatarUrl } from "@/lib/storage/avatar-url";

interface NotificationsPanelProps extends CardProps {
  items: NotificationListItem[];
  unreadCount: number;
  loading: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

function typeChipColor(type: string): ChipProps["color"] {
  switch (type) {
    case "system_announce":
      return "secondary";
    case "weekly_remind":
    case "weekly_approval":
      return "primary";
    case "file_parse":
      return "success";
    case "file_comment":
      return "warning";
    case "file_like":
      return "danger";
    case "file_collect":
      return "default";
    default:
      return "default";
  }
}

function NotificationGlyph({ row }: { row: NotificationListItem }) {
  if (row.sender_id) {
    return (
      <Avatar
        className="h-10 w-10 shrink-0"
        radius="full"
        showFallback
        size="sm"
        src={resolveAvatarUrl(row.sender?.avatar_url ?? null)}
        fallback={
          <Icon
            className="text-default-400"
            icon="solar:user-rounded-bold"
            width={22}
          />
        }
      />
    );
  }

  const systemIcon =
    NOTIFICATION_SYSTEM_TYPE_ICONS[row.type as NotificationTypeValue];
  if (systemIcon) {
    return (
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          "bg-gradient-to-br from-violet-500/25 to-fuchsia-500/15",
          "text-violet-600 dark:text-violet-300",
        )}
      >
        <Icon icon={systemIcon} width={22} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
        "bg-gradient-to-br from-amber-500/25 to-orange-500/10",
        "text-amber-800 dark:text-amber-300",
      )}
    >
      <Icon icon={NOTIFICATION_FILE_FALLBACK_ICON} width={22} />
    </div>
  );
}

function NotificationRowLink({
  row,
  onMarkRead,
  className,
  children,
}: {
  row: NotificationListItem;
  onMarkRead: (id: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const href = parseNotificationUrlFromMeta(row.meta, row.type);
  const handle = () => {
    void onMarkRead(row.id);
  };

  if (!href) {
    return (
      <button
        type="button"
        className={cn(className, "block w-full cursor-pointer text-left")}
        onClick={handle}
      >
        {children}
      </button>
    );
  }
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return (
      <a
        href={href}
        className={cn(className, "block w-full")}
        rel="noreferrer"
        target="_blank"
        onClick={handle}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cn(className, "block w-full")} onClick={handle}>
      {children}
    </Link>
  );
}

export default function NotificationsPanel({
  items,
  unreadCount,
  loading,
  onMarkRead,
  onMarkAllRead,
  className,
  ...rest
}: NotificationsPanelProps) {
  const [tab, setTab] = useState<"all" | "unread">("all");

  const displayed = useMemo(() => {
    if (tab === "unread") return items.filter((n) => !n.is_read);
    return items;
  }, [items, tab]);

  const unreadInList = useMemo(
    () => items.filter((n) => !n.is_read).length,
    [items],
  );

  return (
    <Card className={cn("w-full max-w-[400px] pl-1", className)} {...rest}>
      <CardHeader className="flex flex-col gap-3 px-0 pb-0 pl-5 pr-4 pt-4">
        <div className="flex w-full flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-medium font-semibold tracking-tight">通知</h4>
            {unreadCount > 0 && (
              <Chip size="sm" variant="flat" color="danger">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Chip>
            )}
          </div>
          <Button
            size="sm"
            radius="lg"
            variant="light"
            color="primary"
            isDisabled={unreadCount === 0}
            onPress={() => onMarkAllRead()}
          >
            全部已读
          </Button>
        </div>
        <Tabs
          aria-label="通知筛选"
          selectedKey={tab}
          onSelectionChange={(k) => setTab(k as "all" | "unread")}
          size="md"
          variant="underlined"
          color="primary"
          classNames={{
            base: "w-full",
            tabList: "gap-6 px-6 py-0 w-full relative rounded-none border-b border-divider",
            cursor: "w-full",
            tab: "max-w-fit px-2 h-12",
          }}
        >
          <Tab
            key="all"
            title={
              <div className="flex items-center space-x-2">
                <span> 全部 </span>
                <Chip
                    size="sm"
                    variant="flat"
                    color="default"
                    className="h-5 min-w-5 px-1"
                  >
                    {items.length > 99 ? "99+" : items.length}
                </Chip>
              </div>

            }
          />
          <Tab
            key="unread"
            title={

              <div className="flex items-center space-x-2">
                <span> 未读 </span>
                {unreadInList > 0 && (
                  <Chip
                    size="sm"
                    variant="flat"
                    color="default"
                    // className="h-5 min-w-5 px-1"
                  >
                    {unreadInList > 99 ? "99+" : unreadInList}
                  </Chip>
                )}
              </div>
            }
          />
        </Tabs>
      </CardHeader>
      <CardBody className="gap-0 p-0 pt-1 pl-4 pr-3 pb-3">
        <ScrollShadow className="max-h-[min(60vh,420px)] w-full pl-1">
          {loading && items.length === 0 ? (
            <div className="flex justify-center py-12">
              <Spinner size="sm" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-default-400">
              <Icon icon="solar:bell-off-linear" width={40} />
              <p className="text-small">
                {tab === "unread" ? "暂无未读通知" : "暂无通知"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-default-200/80 dark:divide-default-100/25">
              {displayed.map((row) => (
                <NotificationRowLink
                  key={row.id}
                  row={row}
                  onMarkRead={onMarkRead}
                  className={cn(
                    "w-full transition-colors",
                    "rounded-md px-2 py-2.5 sm:px-2.5",
                    row.is_read
                      ? cn(
                          "hover:bg-default-100/60 dark:hover:bg-default-100/10",
                          "text-default-500",
                        )
                      : cn(
                          "bg-default-100/55 dark:bg-default-100/20",
                          "hover:bg-default-200/45 dark:hover:bg-default-100/30",
                        ),
                  )}
                >
                  <div className="flex gap-3">
                    <div className="flex shrink-0 items-center gap-2.5">
                      <span
                        className="flex h-2 w-2 shrink-0 items-center justify-center"
                        aria-hidden
                      >
                        {!row.is_read ? (
                          <span className="bg-danger block h-1.5 w-1.5 rounded-full" />
                        ) : null}
                      </span>
                      <NotificationGlyph row={row} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "text-small line-clamp-1 font-medium",
                            row.is_read && "font-normal",
                          )}
                        >
                          {row.title}
                        </span>
                        <Chip
                          size="sm"
                          variant="flat"
                          color={typeChipColor(row.type)}
                          className="h-5 max-w-[132px]"
                        >
                          <span className="truncate">
                            {notificationTypeLabel(row.type)}
                          </span>
                        </Chip>
                      </div>
                      {row.content ? (
                        <p
                          className={cn(
                            "mt-0.5 line-clamp-2 text-tiny",
                            row.is_read
                              ? "text-default-400"
                              : "text-default-600 dark:text-default-400",
                          )}
                        >
                          {row.content}
                        </p>
                      ) : null}
                      <time
                        className={cn(
                          "mt-1 block text-tiny",
                          row.is_read
                            ? "text-default-400/90"
                            : "text-default-500",
                        )}
                      >
                        {formatRelativeTimePast(row.created_at)}
                      </time>
                    </div>
                  </div>
                </NotificationRowLink>
              ))}
            </div>
          )}
        </ScrollShadow>
      </CardBody>
    </Card>
  );
}
