'use client'

import { memo, type FC } from 'react'
import { useTheme } from 'next-themes'
import clsx from 'clsx'

export interface ThemeSwitchProps {
  className?: string
}

const ThemeSwitchBase: FC<ThemeSwitchProps> = ({ className }) => {
  const { setTheme } = useTheme()

  return (
    <div
      className={clsx(
        'flex items-center gap-0.5 rounded-full px-1 py-0.5',
        'bg-default-100 dark:bg-default-100/60',
        className
      )}
      role="group"
      aria-label="切换明暗模式"
      suppressHydrationWarning
    >
      <button
        aria-label="切换到亮色模式"
        onClick={() => setTheme('light')}
        className={clsx(
          'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-all duration-200',
          'bg-white text-warning-500 shadow-small',
          'dark:bg-transparent dark:text-default-400 dark:shadow-none dark:hover:text-default-200'
        )}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      </button>

      <button
        aria-label="切换到暗色模式"
        onClick={() => setTheme('dark')}
        className={clsx(
          'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-all duration-200',
          'text-default-400 hover:text-default-600',
          'dark:bg-default-700 dark:text-primary-300 dark:shadow-small'
        )}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20.99 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.78 9.79Z" />
        </svg>
      </button>
    </div>
  )
}

export const ThemeSwitch = memo(ThemeSwitchBase)
