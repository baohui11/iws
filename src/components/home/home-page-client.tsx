'use client'

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@heroui/react'
import FileTypeIcon from '@/components/weekly/file-type-icon'
import type { HomeDashboardData, HomeFileActivityRow } from '@/types/home'

function greetingPeriod(): string {
  const h = new Date().getHours()
  if (h < 5) return '凌晨好'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

function formatActivityDateTime(d: Date): string {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const h = d.getHours()
  const min = d.getMinutes()
  const pad2 = (n: number) => n.toString().padStart(2, '0')
  return `${y}/${m}/${day} ${pad2(h)}:${pad2(min)}`
}

function formatActivitySub(row: HomeFileActivityRow): string {
  const parts: string[] = []
  if (row.projectName) parts.push(row.projectName)
  const d = row.at ? new Date(row.at) : null
  if (d && !Number.isNaN(d.getTime())) {
    parts.push(formatActivityDateTime(d))
  }
  return parts.join(' · ') || '—'
}

export default function HomePageClient({
  displayName,
  dashboard,
}: {
  displayName: string
  dashboard: HomeDashboardData | null
}) {
  const router = useRouter()
  const [fileQuery, setFileQuery] = useState('')

  const period = useMemo(() => greetingPeriod(), [])

  const d = dashboard ?? {
    projectCount: 0,
    currentWeekReportCount: 0,
    monthWorkDays: 0,
    fileUploadCount: 0,
    fileFavoriteCount: 0,
    fileRecommendCount: 0,
    fileActivity: [],
    pmPendingCount: 0,
    isPm: false,
  }

  const goFileSearch = useCallback(() => {
    const q = fileQuery.trim()
    const href = q ? `/files/search?q=${encodeURIComponent(q)}` : '/files/search'
    router.push(href)
  }, [fileQuery, router])

  return (
    <div className="min-h-0 flex-1 bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 md:gap-10 md:px-6 md:py-10 lg:px-8">
        {/* 问候 + 右侧填周报 / 待审批 */}
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-default-200/80 bg-content1/60 px-3 py-1 text-xs text-default-500 backdrop-blur-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/40 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              今日工作台
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              {displayName}，{period}！
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              as={NextLink}
              href="/weekly/reports/new"
              isIconOnly
              radius="full"
              color="primary"
              variant="flat"
              aria-label="填写周报"
              className="size-11 shrink-0"
            >
              <Icon icon="lucide:pen-line" className="size-5" aria-hidden />
            </Button>
            {d.isPm && d.pmPendingCount > 0 ? (
              <Button
                as={NextLink}
                href="/weekly/reports/approvals"
                size="sm"
                color="warning"
                variant="flat"
                className="font-medium"
                startContent={<Icon icon="lucide:clipboard-check" className="size-4" />}
              >
                待审批 {d.pmPendingCount}
              </Button>
            ) : null}
          </div>
        </section>

        {/* 周报指标 */}
        <section aria-label="周报指标" className="grid gap-4 sm:grid-cols-3">
          <LinkCard
            href="/weekly/projects?mine=1"
            label="参与项目"
            icon="lucide:folders"
            tone="primary"
          >
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {d.projectCount}
              <span className="ml-1 text-base font-normal text-default-500">个</span>
            </span>
          </LinkCard>
          <LinkCard
            href="/weekly/reports"
            label="本周周报"
            icon="lucide:calendar-check-2"
            tone="secondary"
          >
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {d.currentWeekReportCount}
              <span className="ml-1 text-base font-normal text-default-500">个</span>
            </span>
          </LinkCard>
          <LinkCard
            href="/weekly/attendance"
            label="本月工作天数"
            icon="lucide:timer"
            tone="success"
          >
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {d.monthWorkDays}
              <span className="ml-1 text-base font-normal text-default-500">天</span>
            </span>
          </LinkCard>
        </section>

        {/* 文件指标 */}
        <section aria-label="文件指标" className="grid gap-4 sm:grid-cols-3">
          <LinkCard
            href="/files/mine?tab=uploads"
            label="上传文件"
            icon="lucide:upload-cloud"
            tone="primary"
          >
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {d.fileUploadCount}
              <span className="ml-1 text-base font-normal text-default-500">个</span>
            </span>
          </LinkCard>
          <LinkCard
            href="/files/mine?tab=favorites"
            label="收藏文件"
            icon="lucide:star"
            tone="secondary"
          >
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {d.fileFavoriteCount}
              <span className="ml-1 text-base font-normal text-default-500">个</span>
            </span>
          </LinkCard>
          <LinkCard
            href="/files/mine?tab=recommends"
            label="推荐文件"
            icon="lucide:sparkles"
            tone="success"
          >
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {d.fileRecommendCount}
              <span className="ml-1 text-base font-normal text-default-500">个</span>
            </span>
          </LinkCard>
        </section>

        {/* 文件检索 */}
        <section aria-label="文件检索">
          <Card className="overflow-hidden border border-default-200/70 bg-content1 shadow-md">
            <CardHeader className="border-b border-default-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Icon icon="lucide:search" className="size-5 text-primary" aria-hidden />
                <span className="text-sm font-semibold text-foreground">文件检索</span>
              </div>
            </CardHeader>
            <CardBody className="flex flex-col gap-3 px-5 pb-5 pt-2 sm:flex-row sm:items-end">
              <Input
                aria-label="文件检索关键词"
                size="lg"
                radius="lg"
                variant="flat"
                value={fileQuery}
                onValueChange={setFileQuery}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    goFileSearch()
                  }
                }}
                classNames={{
                  base: 'w-full min-w-0 flex-1',
                  inputWrapper:
                    'h-12 bg-default-100/90 shadow-inner data-[hover=true]:bg-default-100',
                  input: 'text-base',
                }}
                placeholder="输入关键词，回车或点击搜索跳转…"
                startContent={
                  <Icon
                    icon="lucide:file-search"
                    className="size-5 text-default-400"
                    aria-hidden
                  />
                }
              />
              <Button
                color="primary"
                size="md"
                radius="lg"
                className="h-12 min-w-[5.5rem] shrink-0 font-medium"
                onPress={goFileSearch}
              >
                搜索
              </Button>
            </CardBody>
          </Card>
        </section>

        {/* 文件动态 */}
        <section aria-label="文件动态">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">文件动态</h2>
            <NextLink
              href="/files/search"
              className="text-sm text-default-500 transition-colors hover:text-primary"
            >
              查看全部
            </NextLink>
          </div>
          <Card className="border border-default-200/70 bg-content1/60 shadow-sm backdrop-blur-sm">
            <CardBody className="divide-y divide-default-100 p-0">
              {d.fileActivity.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-default-500">暂无动态</p>
              ) : (
                d.fileActivity.map((row) => (
                  <NextLink
                    key={row.id}
                    href={`/files/${row.fileId}/preview`}
                    className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-default-50/80 dark:hover:bg-default-100/5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm leading-relaxed">
                        <span className="text-foreground">{row.actorName}</span>
                        <span className="text-default-500">
                          {row.kind === 'upload' ? '上传了' : '推荐了'}
                        </span>
                        <FileTypeIcon
                          fileName={row.fileName}
                          className="size-5 shrink-0 object-contain"
                        />
                        <span className="text-primary">{row.fileName}</span>
                      </p>
                      <p className="mt-1 text-xs text-default-500">{formatActivitySub(row)}</p>
                    </div>
                    <Icon
                      icon="lucide:chevron-right"
                      className="mt-1 size-4 shrink-0 text-default-400"
                      aria-hidden
                    />
                  </NextLink>
                ))
              )}
            </CardBody>
          </Card>
        </section>

        {/* 底部占位 */}
        <section
          aria-label="活动与推荐"
          className="grid gap-4 md:grid-cols-2"
        >
          <div className="flex min-h-[140px] flex-col justify-between rounded-2xl border border-dashed border-default-300 bg-default-50 p-5 dark:bg-default-100/20">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">活动 / 公告</span>
              <Chip size="sm" variant="bordered" className="border-dashed">
                待上线
              </Chip>
            </div>
            <p className="text-xs leading-relaxed text-default-500">
              运营活动、系统公告等将展示在此区域。
            </p>
          </div>
          <div className="flex min-h-[140px] flex-col justify-between rounded-2xl border border-dashed border-default-300 bg-default-50 p-5 dark:bg-default-100/20">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">文件榜单</span>
              <Chip size="sm" variant="bordered" className="border-dashed">
                待上线
              </Chip>
            </div>
            <p className="text-xs leading-relaxed text-default-500">
              文件榜单、热门文件等将展示在此区域。
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

function LinkCard({
  href,
  label,
  icon,
  tone,
  children,
}: {
  href: string
  label: string
  icon: string
  tone: 'primary' | 'secondary' | 'success'
  children: ReactNode
}) {
  const ring =
    tone === 'primary'
      ? 'bg-primary/10 text-primary'
      : tone === 'secondary'
        ? 'bg-secondary/15 text-secondary'
        : 'bg-success/15 text-success'

  return (
    <NextLink href={href} className="block">
      <Card className="h-full border border-default-200/60 bg-content1/70 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
        <CardBody className="flex flex-row items-center gap-4 p-5">
          <span
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-2xl',
              ring
            )}
          >
            <Icon icon={icon} className="size-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-default-400">
              {label}
            </p>
            <p className="mt-0.5">{children}</p>
          </div>
        </CardBody>
      </Card>
    </NextLink>
  )
}
