'use client'

import { Button, Tooltip } from '@heroui/react'
import { Icon } from '@iconify/react'

export interface FileUploadInteractionIconsProps {
  recommend: boolean
  favorite: boolean
  disabled?: boolean
  onToggleRecommend: () => void
  onToggleFavorite: () => void
}

/** 上传队列中：推荐、收藏（对应 file_interactions） */
export default function FileUploadInteractionIcons({
  recommend,
  favorite,
  disabled,
  onToggleRecommend,
  onToggleFavorite,
}: FileUploadInteractionIconsProps) {
  return (
    <div className="inline-flex shrink-0 items-center gap-0.5">
      <Tooltip content="推荐该文件" placement="top" delay={200}>
        <Button
          isIconOnly
          size="sm"
          variant={recommend ? 'flat' : 'light'}
          color={recommend ? 'primary' : 'default'}
          isDisabled={disabled}
          aria-pressed={recommend}
          aria-label="推荐"
          onPress={onToggleRecommend}
        >
          <Icon icon="lucide:thumbs-up" className="size-4" aria-hidden />
        </Button>
      </Tooltip>
      <Tooltip content="收藏该文件" placement="top" delay={200}>
        <Button
          isIconOnly
          size="sm"
          variant={favorite ? 'flat' : 'light'}
          color={favorite ? 'secondary' : 'default'}
          isDisabled={disabled}
          aria-pressed={favorite}
          aria-label="收藏"
          onPress={onToggleFavorite}
        >
          <Icon
            icon={favorite ? 'mdi:star' : 'mdi:star-outline'}
            className="size-4"
            aria-hidden
          />
        </Button>
      </Tooltip>
    </div>
  )
}
