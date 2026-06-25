'use client'

import { FC, useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import clsx from 'clsx'
import { Icon, addCollection } from '@iconify/react'
import solarIcons from '@iconify-json/solar/icons.json'

addCollection(solarIcons as Parameters<typeof addCollection>[0])

export interface ThemeSwitchProps {
  className?: string
}

export const ThemeSwitch: FC<ThemeSwitchProps> = ({ className }) => {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // 仅客户端挂载后再渲染主题态，避免 SSR 水合不一致
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  const isLight = theme === 'light'

  if (!mounted) {
    return (
      <div
        className={clsx(
          'flex items-center gap-0.5 rounded-full px-1 py-0.5',
          'bg-default-100 dark:bg-default-100/60',
          className
        )}
        aria-hidden="true"
      >
        <span className="h-7 w-7" />
        <span className="h-7 w-7" />
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'flex items-center gap-0.5 rounded-full px-1 py-0.5',
        'bg-default-100 dark:bg-default-100/60',
        className
      )}
      role="group"
      aria-label="切换明暗模式"
    >
      <button
        aria-label="切换到亮色模式"
        aria-pressed={isLight}
        onClick={() => setTheme('light')}
        className={clsx(
          'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-all duration-200',
          isLight
            ? 'dark:bg-default-200 text-warning-500 shadow-small bg-white'
            : 'text-default-400 hover:text-default-600'
        )}
      >
        <Icon icon="solar:sun-bold" width={15} height={16} />
      </button>

      <button
        aria-label="切换到暗色模式"
        aria-pressed={!isLight}
        onClick={() => setTheme('dark')}
        className={clsx(
          'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-all duration-200',
          !isLight
            ? 'bg-default-700 text-primary-300 shadow-small'
            : 'text-default-400 hover:text-default-600'
        )}
      >
        <Icon icon="solar:moon-bold" width={16} height={16} />
      </button>
    </div>
  )
}
