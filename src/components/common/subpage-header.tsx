'use client'

import { useRouter } from 'next/navigation'
import { Button, cn } from '@heroui/react'
import { Icon } from '@iconify/react'

export interface SubpageHeaderProps {
  title: string
  /** 标题下方说明（可选） */
  description?: string | null
  /**
   * 为 true 时显示「返回」按钮，行为等同于浏览器后退（history.back()），
   * 不再使用固定链接跳转。
   */
  showBack?: boolean
  /** 包裹层 class，例如与右侧工具栏并排时传 `mb-0` */
  className?: string
}

/**
 * 通用子页面顶栏：可选返回 + 标题 + 可选说明。
 * 集中使用 `use client`，服务端页面只引用本组件即可。
 */
export default function SubpageHeader({
  title,
  description,
  showBack = false,
  className,
}: SubpageHeaderProps) {
  const router = useRouter()
  return (
    <div className={cn('mb-8', className)}>
      {showBack ? (
        <Button
          variant="light"
          size="sm"
          className="-ml-2 mb-4 text-primary-600"
          startContent={
            <Icon icon="lucide:arrow-left" className="size-4" aria-hidden />
          }
          onPress={() => router.back()}
        >
          返回
        </Button>
      ) : null}
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="mt-1 text-sm text-default-500">{description}</p>
      ) : null}
    </div>
  )
}

export interface SubpageBackButtonProps {
  className?: string
  /** 与页面内其它次要按钮一致时可用 `flat` */
  variant?: 'light' | 'flat'
  /**
   * 若传入则跳转到该路径（如列表页），否则为浏览器后退（history.back()）。
   * 用于从编辑流程进入详情页等场景，避免「返回」回到上一步编辑页。
   */
  href?: string
}

/**
 * 与 {@link SubpageHeader} 类似：默认 `history.back()`；
 * 传入 `href` 时改为跳转到固定地址（如周报列表）。
 */
export function SubpageBackButton({
  className,
  variant = 'flat',
  href,
}: SubpageBackButtonProps) {
  const router = useRouter()
  return (
    <Button
      variant={variant}
      size="sm"
      className={cn(
        variant === 'light' ? 'text-primary-600' : undefined,
        className
      )}
      startContent={
        <Icon icon="lucide:arrow-left" className="size-4" aria-hidden />
      }
      onPress={() => (href ? router.push(href) : router.back())}
    >
      返回
    </Button>
  )
}
