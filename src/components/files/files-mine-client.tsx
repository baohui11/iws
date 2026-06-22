'use client'

import {
  Button,
  Input,
  Spinner,
  Tab,
  Tabs,
  Tooltip,
  addToast,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import NextLink from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type Key,
} from 'react'

import SubpageHeader from '@/components/common/subpage-header'
import FileTypeIcon from '@/components/weekly/file-type-icon'
import { loadMineFilesPageAction } from '@/actions/files/mine-files.action'
import type { FilesMineTab, MineFileRow } from '@/lib/db/files/mine-files'

const VIEW_STORAGE_KEY = 'files-mine-view'

type ViewMode = 'card' | 'list'

const TABS: { key: FilesMineTab; label: string }[] = [
  { key: 'uploads', label: '我的上传' },
  { key: 'favorites', label: '我的收藏' },
  { key: 'recommends', label: '我的推荐' },
]

function formatWhen(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const h = d.getHours()
  const min = d.getMinutes()
  const pad2 = (n: number) => n.toString().padStart(2, '0')
  return `${y}/${m}/${day} ${pad2(h)}:${pad2(min)}`
}

/** 过长时在中间插入省略号，便于两行内展示 */
function truncateMiddleFileName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name
  const ellipsis = '…'
  if (maxLen <= ellipsis.length) return ellipsis.slice(0, maxLen)
  const usable = maxLen - ellipsis.length
  const left = Math.ceil(usable / 2)
  const right = Math.floor(usable / 2)
  return name.slice(0, left) + ellipsis + name.slice(name.length - right)
}

const CARD_NAME_MAX_CHARS = 44

function readStoredView(): ViewMode {
  if (typeof window === 'undefined') return 'list'
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY)
    if (v === 'card' || v === 'list') return v
  } catch {
    /* ignore */
  }
  return 'list'
}

export default function FilesMineClient({
  tab,
  initialSearch,
  initialRows,
  initialHasMore,
}: {
  tab: FilesMineTab
  initialSearch: string
  initialRows: MineFileRow[]
  initialHasMore: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [rows, setRows] = useState<MineFileRow[]>(initialRows)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loadingMore, setLoadingMore] = useState(false)
  const [view, setView] = useState<ViewMode>('list')
  const [searchDraft, setSearchDraft] = useState(initialSearch)
  const [isSearchPending, startSearchTransition] = useTransition()
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingRef = useRef(false)

  const fileNameQueryFromUrl = (searchParams.get('q') ?? '').trim()

  useLayoutEffect(() => {
    setView(readStoredView())
  }, [])

  useEffect(() => {
    setRows(initialRows)
    setHasMore(initialHasMore)
  }, [initialRows, initialHasMore])

  useEffect(() => {
    setSearchDraft(initialSearch)
  }, [initialSearch])

  const applySearch = useCallback(() => {
    const next = searchDraft.trim()
    if (next === fileNameQueryFromUrl) return
    startSearchTransition(() => {
      const params = new URLSearchParams()
      params.set('tab', tab)
      if (next) params.set('q', next)
      router.replace(`/files/mine?${params.toString()}`)
    })
  }, [searchDraft, tab, router, fileNameQueryFromUrl])

  const persistView = useCallback((v: ViewMode) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v)
    } catch {
      /* ignore */
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingRef.current) return
    loadingRef.current = true
    setLoadingMore(true)
    const res = await loadMineFilesPageAction({
      tab,
      offset: rows.length,
      fileNameQuery: fileNameQueryFromUrl || null,
    })
    loadingRef.current = false
    setLoadingMore(false)
    if (!res.success || !res.data) {
      addToast({
        title: '加载失败',
        description: res.message ?? '请稍后重试',
        color: 'danger',
      })
      return
    }
    setRows((prev) => {
      const seen = new Set(prev.map((r) => r.file_id))
      const next = [...prev]
      for (const r of res.data!.rows) {
        if (!seen.has(r.file_id)) {
          seen.add(r.file_id)
          next.push(r)
        }
      }
      return next
    })
    setHasMore(res.data.hasMore)
  }, [hasMore, tab, rows.length, fileNameQueryFromUrl])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (!first?.isIntersecting) return
        void loadMore()
      },
      { root: null, rootMargin: '120px', threshold: 0 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  const onTabChange = (key: Key) => {
    const k = String(key) as FilesMineTab
    const params = new URLSearchParams()
    params.set('tab', k)
    const q = searchParams.get('q')?.trim()
    if (q) params.set('q', q)
    router.push(`/files/mine?${params.toString()}`)
  }

  return (
    <>
      <SubpageHeader showBack title="我的文件" />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 w-full flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <Input
            aria-label="搜索文件名"
            size="md"
            radius="lg"
            variant="flat"
            placeholder="输入关键词后点击搜索或按回车"
            value={searchDraft}
            onValueChange={setSearchDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applySearch()
              }
            }}
            classNames={{
              base: 'w-full min-w-0 flex-1',
              inputWrapper: 'h-11 bg-default-100/90 shadow-inner',
            }}
            startContent={
              <Icon icon="lucide:search" className="size-4 text-default-400" aria-hidden />
            }
            isClearable
            onClear={() => {
              setSearchDraft('')
              if ((searchParams.get('q') ?? '').trim()) {
                startSearchTransition(() => {
                  const params = new URLSearchParams()
                  params.set('tab', tab)
                  router.replace(`/files/mine?${params.toString()}`)
                })
              }
            }}
          />
          <Button
            color="primary"
            size="sm"
            onPress={applySearch}
            isLoading={isSearchPending}
            startContent={
              !isSearchPending && (
                <Icon icon="lucide:search" className="size-4" aria-hidden />
              )
            }
          >
            搜索
          </Button>
        </div>
        <div
          className="inline-flex shrink-0 justify-end rounded-medium border border-default-200 bg-default-100/80 p-0.5 sm:justify-start"
          role="group"
          aria-label="视图模式"
        >
          <Button
            size="sm"
            variant={view === 'card' ? 'solid' : 'light'}
            color={view === 'card' ? 'primary' : 'default'}
            isIconOnly
            radius="sm"
            aria-label="卡片视图"
            aria-pressed={view === 'card'}
            onPress={() => persistView('card')}
          >
            <Icon icon="lucide:layout-grid" className="size-4" aria-hidden />
          </Button>
          <Button
            size="sm"
            variant={view === 'list' ? 'solid' : 'light'}
            color={view === 'list' ? 'primary' : 'default'}
            isIconOnly
            radius="sm"
            aria-label="列表视图"
            aria-pressed={view === 'list'}
            onPress={() => persistView('list')}
          >
            <Icon icon="lucide:list" className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <Tabs
        aria-label="我的文件分类"
        selectedKey={tab}
        onSelectionChange={onTabChange}
        className="w-full"
        classNames={{ panel: 'hidden' }}
      >
        {TABS.map((t) => (
          <Tab key={t.key} title={t.label} />
        ))}
      </Tabs>

      <div className="mt-4">
        {rows.length === 0 && !loadingMore ? (
          <p className="rounded-lg border border-dashed border-default-300 py-12 text-center text-sm text-default-500">
            暂无记录
          </p>
        ) : view === 'card' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {rows.map((r) => {
              const displayName =
                r.file_name.length > CARD_NAME_MAX_CHARS
                  ? truncateMiddleFileName(r.file_name, CARD_NAME_MAX_CHARS)
                  : r.file_name
              return (
                <NextLink
                  key={r.file_id}
                  href={`/files/${r.file_id}/preview`}
                  className="group flex flex-col items-stretch rounded-lg text-left outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <div className="flex min-h-[5.5rem] w-full items-center justify-center px-2 pt-4">
                    <FileTypeIcon
                      fileName={r.file_name}
                      className="size-14 shrink-0 object-contain transition-transform group-hover:scale-105"
                    />
                  </div>
                  <Tooltip
                    content={r.file_name}
                    placement="top"
                    delay={250}
                    isDisabled={r.file_name.length <= CARD_NAME_MAX_CHARS}
                  >
                    <p className="mt-2 line-clamp-2 w-full cursor-default break-words px-2 text-center text-xs leading-snug text-foreground">
                      {displayName}
                    </p>
                  </Tooltip>
                  <p className="mt-auto px-2 pb-3 pt-1 text-center text-[10px] text-default-400 tabular-nums">
                    {formatWhen(r.sort_at)}
                  </p>
                </NextLink>
              )
            })}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-default-200 bg-content1 shadow-sm">
            <table className="min-w-full divide-y divide-default-100 text-sm">
              <thead>
                <tr className="bg-default-50/80 text-left text-xs text-default-600">
                  <th className="px-4 py-3 font-medium">文件</th>
                  <th className="px-4 py-3 font-medium">项目</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">时间</th>
                  <th className="px-4 py-3 w-24 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default-100">
                {rows.map((r) => (
                  <tr key={r.file_id} className="hover:bg-default-50/50">
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileTypeIcon
                          fileName={r.file_name}
                          className="size-5 shrink-0 object-contain"
                        />
                        <span className="min-w-0 font-medium text-foreground">
                          {r.file_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-default-600">
                      {r.project_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-default-500 tabular-nums">
                      {formatWhen(r.sort_at)}
                    </td>
                    <td className="px-4 py-3">
                      <NextLink
                        href={`/files/${r.file_id}/preview`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        预览
                      </NextLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasMore ? (
          <div
            ref={sentinelRef}
            className="flex min-h-10 items-center justify-center py-4"
            aria-hidden
          >
            {loadingMore ? (
              <Spinner size="sm" label="加载中" color="primary" />
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  )
}
