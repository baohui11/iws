'use client'

import { Tab, Tabs } from '@heroui/react'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo, type ReactNode } from 'react'

const TAB_KEYS = ['reports', 'files', 'info'] as const

export type ProjectDetailTabKey = (typeof TAB_KEYS)[number]

function activeTabFromPathname(
  pathname: string,
  projectId: string
): ProjectDetailTabKey {
  const base = `/weekly/projects/${projectId}/`
  if (!pathname.startsWith(base)) return 'reports'
  const rest = pathname.slice(base.length).split('/')[0] ?? ''
  if (rest === 'files') return 'files'
  if (rest === 'reports') return 'reports'
  if (rest === 'info') return 'info'
  return 'reports'
}

export function ProjectTabsShell({
  projectId,
  children,
}: {
  projectId: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const active = useMemo(
    () => activeTabFromPathname(pathname, projectId),
    [pathname, projectId]
  )

  return (
    <Tabs
      aria-label="项目详情"
      // color="primary"
      // variant="underlined"
      selectedKey={active}
      onSelectionChange={(key) => {
        const k = String(key) as ProjectDetailTabKey
        router.push(`/weekly/projects/${projectId}/${k}`)
      }}
      // classNames={{
      //   tabList: 'gap-8 w-full',
      //   panel: 'pt-6',
      // }}
    >
      <Tab key="reports" title="项目周报">
        {active === 'reports' ? children : null}
      </Tab>
      <Tab key="files" title="项目文件">
        {active === 'files' ? children : null}
      </Tab>
      <Tab key="info" title="项目基本信息">
        {active === 'info' ? children : null}
      </Tab>
    </Tabs>
  )
}
