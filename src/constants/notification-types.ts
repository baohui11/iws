/**
 * 与 notifications.type 约定一致。后续若 DB 改为 enum，可同步 types/database。
 */
export const NOTIFICATION_TYPES = [
  'system_announce',
  'weekly_remind',
  'weekly_approval',
  'file_parse',
  'file_comment',
  'file_like',
  'file_collect',
] as const

export type NotificationTypeValue = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_TYPE_LABEL: Record<NotificationTypeValue, string> = {
  system_announce: '系统公告',
  weekly_remind: '周报填写提醒',
  weekly_approval: '周报审批',
  file_parse: '文件解析完成',
  file_comment: '文件评论',
  file_like: '文件点赞',
  file_collect: '文件收藏',
}

export function notificationTypeLabel(type: string): string {
  return NOTIFICATION_TYPE_LABEL[type as NotificationTypeValue] ?? type
}

/** 无发送者时展示的系统类图标（系统公告 / 周报 / 解析等） */
export const NOTIFICATION_SYSTEM_TYPE_ICONS: Partial<
  Record<NotificationTypeValue, string>
> = {
  system_announce: 'solar:chat-round-dots-bold',
  weekly_remind: 'solar:calendar-mark-bold',
  weekly_approval: 'solar:clipboard-check-bold',
  file_parse: 'solar:document-text-bold',
}

/** 无发送者时的文件互动类兜底图标 */
export const NOTIFICATION_FILE_FALLBACK_ICON = 'solar:folder-with-files-bold'
