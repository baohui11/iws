'use client'

import { useRouter } from 'next/navigation'
import { Button, cn } from '@heroui/react'
import { Icon } from '@iconify/react'

export interface SubpageHeaderProps {
  title: string
  description?: string | null
  showBack?: boolean
  className?: string
}

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
          className="text-primary-600 -ml-2 mb-4"
          startContent={
            <Icon icon="lucide:arrow-left" className="size-4" aria-hidden />
          }
          onPress={() => router.back()}
        >
          返回
        </Button>
      ) : null}
      <h1 className="text-foreground text-2xl font-bold tracking-tight">
        {title}
      </h1>
      {description ? (
        <p className="text-default-500 mt-1 text-sm">{description}</p>
      ) : null}
    </div>
  )
}

export interface SubpageBackButtonProps {
  className?: string
  variant?: 'light' | 'flat'
  href?: string
}

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
