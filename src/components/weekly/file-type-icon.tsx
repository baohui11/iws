'use client'

import { getFileTypeIconSrc } from '@/lib/utils/file-type-icon'

export interface FileTypeIconProps {
  fileName: string
  /** 默认 20×20 视口，与列表行高协调 */
  className?: string
}

/** 列表中文件名前的文件类型小图标（`public/icons/file-types`） */
export default function FileTypeIcon({
  fileName,
  className = 'size-5 shrink-0 object-contain',
}: FileTypeIconProps) {
  return (
    <img
      src={getFileTypeIconSrc(fileName)}
      alt=""
      width={20}
      height={20}
      className={className}
      aria-hidden
    />
  )
}
