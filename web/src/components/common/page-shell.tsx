import { cn } from '@heroui/react'

type PageShellWidth = 'sm' | 'md' | 'lg' | 'xl'

const widthClass: Record<PageShellWidth, string> = {
  sm: 'max-w-3xl',
  md: 'max-w-4xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl',
}

export interface PageShellProps {
  children: React.ReactNode
  width?: PageShellWidth
  className?: string
}

export default function PageShell({
  children,
  width = 'xl',
  className,
}: PageShellProps) {
  return (
    <div
      className={cn(
        'container mx-auto w-full px-4 py-8',
        widthClass[width],
        className
      )}
    >
      {children}
    </div>
  )
}
