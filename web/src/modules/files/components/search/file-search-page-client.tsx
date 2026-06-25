'use client'

import { searchDocumentsAction } from '@/modules/files/search/actions'
import FileTypeIcon from '@/modules/files/components/upload/file-type-icon'
import { StatsLabelField } from '@/modules/stats/components/shared/stats-label-field'
import type { DeptOption } from '@/modules/stats/types'
import type { DocSearchHit, DocSearchResponse } from '@/modules/files/types'
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Pagination,
  Select,
  SelectItem,
  Spinner,
  addToast,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react'

const PAGE_SIZE = 10

const FILE_TYPE_LABEL: Record<string, string> = {
  deliverable: '成果文件',
  reference_client: '客户资料',
  reference_internal: '内部资料',
  reference_public: '公开资料',
}

const EXT_PRESETS: { key: string; ext: string; label: string }[] = [
  { key: 'all', ext: '', label: '不限' },
  { key: 'pdf', ext: 'pdf', label: '.pdf' },
  { key: 'docx', ext: 'docx', label: '.docx' },
  { key: 'doc', ext: 'doc', label: '.doc' },
  { key: 'xlsx', ext: 'xlsx', label: '.xlsx' },
  { key: 'xls', ext: 'xls', label: '.xls' },
  { key: 'pptx', ext: 'pptx', label: '.pptx' },
  { key: 'ppt', ext: 'ppt', label: '.ppt' },
  { key: 'md', ext: 'md', label: '.md' },
  { key: 'txt', ext: 'txt', label: '.txt' },
  { key: 'csv', ext: 'csv', label: '.csv' },
]

const ALL_DEPT_KEY = '__all_dept__'
const ALL_PROJECT_KEY = '__all_proj__'

const SOURCE_SEGMENTS: { value: string; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'deliverable', label: '成果文件' },
  { value: 'reference_client', label: '客户资料' },
  { value: 'reference_internal', label: '内部资料' },
  { value: 'reference_public', label: '公开资料' },
]

/** 与周报列表「展示方式」一致：圆角边框 + 无缝拼接按钮（紧凑宽度） */
function SegmentedToggle<T extends string>({
  'aria-label': ariaLabel,
  value,
  onChange,
  options,
}: {
  'aria-label': string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div
      className="w-fit max-w-full overflow-hidden rounded-medium border border-default-200 bg-default-50/80 p-0 dark:bg-default-100/10"
      role="group"
      aria-label={ariaLabel}
    >
      <div className="flex min-w-0 overflow-x-auto">
        <div className="flex shrink-0 gap-0">
          {options.map((opt) => {
            const active = value === opt.value
            return (
              <Button
                key={String(opt.value)}
                size="md"
                variant={active ? 'solid' : 'light'}
                color={active ? 'primary' : 'default'}
                className="shrink-0 rounded-none px-2 text-md font-medium sm:px-2.5 sm:text-sm"
                onPress={() => onChange(opt.value)}
              >
                {opt.label}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export type FileSearchInitial = {
  q: string
  projectId: string
  departmentId: string
  fileType: string
  fileExt: string
}

export type ProjectOption = { id: string; label: string }

function HighlightText({ html }: { html: string }) {
  const parts: ReactNode[] = []
  const re = /<em>([\s\S]*?)<\/em>/gi
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (m.index > last) parts.push(html.slice(last, m.index))
    parts.push(
      <em
        key={`${m.index}-h`}
        className="font-semibold text-primary not-italic"
      >
        {m[1]}
      </em>
    )
    last = m.index + m[0].length
  }
  if (last < html.length) parts.push(html.slice(last))
  return <>{parts}</>
}

function displayFileName(hit: DocSearchHit) {
  const raw =
    hit._formatted?.file_name?.trim() || hit.file_name?.trim() || '未命名文件'
  if (raw.includes('<em>')) return <HighlightText html={raw} />
  return raw
}

function displaySnippet(hit: DocSearchHit) {
  const raw =
    hit._formatted?.content?.trim() ||
    hit.content?.trim() ||
    '（无正文片段）'
  if (raw.includes('<em>')) return <HighlightText html={raw} />
  return raw
}

function fileTypeLabel(code: string | undefined) {
  if (!code) return ''
  return FILE_TYPE_LABEL[code] ?? code
}

export default function FileSearchPageClient({
  departmentOptions,
  projectOptions,
  initialFilters,
}: {
  departmentOptions: DeptOption[]
  projectOptions: ProjectOption[]
  initialFilters: FileSearchInitial
}) {
  const router = useRouter()

  const [query, setQuery] = useState(initialFilters.q)
  const [projectId, setProjectId] = useState(initialFilters.projectId)
  const [departmentId, setDepartmentId] = useState(initialFilters.departmentId)
  const [fileType, setFileType] = useState(initialFilters.fileType)
  const [fileExt, setFileExt] = useState(initialFilters.fileExt)

  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)

  const [page, setPage] = useState(1)
  const [result, setResult] = useState<DocSearchResponse | null>(null)
  const [pending, startTransition] = useTransition()

  const deptItems = useMemo(
    () => [
      { id: ALL_DEPT_KEY, label: '全部部门' },
      ...departmentOptions.map((d) => ({ id: d.id, label: d.label })),
    ],
    [departmentOptions]
  )

  const projItems = useMemo(
    () => [
      { id: ALL_PROJECT_KEY, label: '全部项目' },
      ...projectOptions.map((p) => ({ id: p.id, label: p.label })),
    ],
    [projectOptions]
  )

  const extItemsForSelect = useMemo(
    () => [
      ...EXT_PRESETS,
      { key: 'custom', ext: 'custom', label: '其他…' },
    ],
    []
  )

  const extSelectKey = useMemo(() => {
    const raw = fileExt.trim().replace(/^\./, '').toLowerCase()
    if (!raw) return 'all'
    const hit = EXT_PRESETS.find((e) => e.ext === raw)
    return hit?.key ?? 'custom'
  }, [fileExt])

  const filtersPayload = useMemo(() => {
    const f: Record<string, string | boolean> = {}
    if (projectId.trim()) f.project_id = projectId.trim()
    if (departmentId.trim()) f.department_id = departmentId.trim()
    if (fileType.trim()) f.file_type = fileType.trim()
    if (fileExt.trim()) f.file_ext = fileExt.trim().replace(/^\./, '')
    return f
  }, [projectId, departmentId, fileType, fileExt])

  const runSearch = useCallback(
    (nextPage: number) => {
      if (!query.trim()) {
        setResult(null)
        setPage(1)
        return
      }
      const offset = (nextPage - 1) * PAGE_SIZE
      startTransition(async () => {
        const res = await searchDocumentsAction({
          q: query,
          limit: PAGE_SIZE,
          offset,
          filters: filtersPayload,
          max_content_chars: 600,
        })
        if (!res.success) {
          addToast({
            title: '检索失败',
            description: res.message ?? '请稍后重试',
            color: 'danger',
          })
          setResult(null)
          return
        }
        setResult(res.data)
        setPage(nextPage)
      })
    },
    [query, filtersPayload]
  )

  useEffect(() => {
    setQuery(initialFilters.q)
    setProjectId(initialFilters.projectId)
    setDepartmentId(initialFilters.departmentId)
    setFileType(initialFilters.fileType)
    setFileExt(initialFilters.fileExt)
  }, [initialFilters])

  useEffect(() => {
    if (!query.trim()) {
      setResult(null)
      setPage(1)
    }
  }, [query])

  const syncUrl = useCallback(() => {
    const p = new URLSearchParams()
    if (query.trim()) p.set('q', query.trim())
    if (projectId.trim()) p.set('project_id', projectId.trim())
    if (departmentId.trim()) p.set('department_id', departmentId.trim())
    if (fileType.trim()) p.set('file_type', fileType.trim())
    if (fileExt.trim()) p.set('file_ext', fileExt.trim())
    const qs = p.toString()
    router.replace(qs ? `/files/search?${qs}` : '/files/search', {
      scroll: false,
    })
  }, [router, query, projectId, departmentId, fileType, fileExt])

  const resetFilters = useCallback(() => {
    setDepartmentId('')
    setProjectId('')
    setFileType('')
    setFileExt('')
    const p = new URLSearchParams()
    if (query.trim()) p.set('q', query.trim())
    const qs = p.toString()
    router.replace(qs ? `/files/search?${qs}` : '/files/search', {
      scroll: false,
    })
  }, [query, router])

  const onSubmit = () => {
    if (!query.trim()) {
      addToast({
        title: '请输入关键词',
        description: '主搜索框不能为空',
        color: 'warning',
      })
      return
    }
    syncUrl()
    runSearch(1)
  }

  useEffect(() => {
    if (!initialFilters.q.trim()) return
    runSearch(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalPages = useMemo(() => {
    const t = result?.estimatedTotalHits
    if (t != null && t > 0) {
      return Math.max(1, Math.ceil(t / PAGE_SIZE))
    }
    if (!result) return 1
    if (result.hits.length < PAGE_SIZE) return page
    return page + 1
  }, [result, page])

  const onPageChange = (p: number) => {
    syncUrl()
    runSearch(p)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 md:max-w-5xl md:px-8 md:py-10">
        <section aria-label="检索条件">
          <Card
            shadow="md"
            classNames={{
              base: 'overflow-visible border border-default-200/60 bg-content1 shadow-md',
            }}
          >
            <CardBody className="gap-6 px-5 pb-8 pt-7">
              <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:gap-4">
                <Input
                  aria-label="搜索关键词"
                  size="md"
                  radius="md"
                  variant="bordered"
                  value={query}
                  onValueChange={setQuery}
                  classNames={{
                    base: 'min-w-0 flex-1',
                    inputWrapper:
                      'h-12 border-2 border-default-200/90 bg-gradient-to-br from-default-50/90 to-content1 shadow-md transition-colors data-[hover=true]:border-primary/30',
                    input:
                      'text-md placeholder:text-default-400 md:text-base',
                  }}
                  placeholder="搜索文件名、正文关键词…"
                  startContent={
                    <Icon
                      icon="lucide:search"
                      className="pointer-events-none ms-1 size-6 shrink-0 text-primary/70"
                      aria-hidden
                    />
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSubmit()
                  }}
                />
                <Button
                  color="primary"
                  size="md"
                  radius="md"
                  className="shrink-0"
                  isDisabled={!query.trim()}
                  isLoading={pending}
                  startContent={
                    !pending ? (
                      <Icon icon="lucide:sparkles" className="size-4" aria-hidden />
                    ) : null
                  }
                  onPress={onSubmit}
                >
                  搜索
                </Button>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <Button
                    variant="light"
                    size="sm"
                    className="w-fit shrink-0 gap-1 px-1 text-default-600"
                    onPress={() => setMoreFiltersOpen((v) => !v)}
                    endContent={
                      <Icon
                        icon={
                          moreFiltersOpen
                            ? 'lucide:chevron-up'
                            : 'lucide:chevron-down'
                        }
                        className="size-4"
                        aria-hidden
                      />
                    }
                  >
                    更多过滤
                  </Button>
                  <Button
                    as={Link}
                    href="/files/mine"
                    variant="light"
                    color="primary"
                    size="sm"
                    className="shrink-0 font-medium"
                    startContent={
                      <Icon
                        icon="lucide:folder-open"
                        className="size-4 shrink-0"
                        aria-hidden
                      />
                    }
                  >
                    我的文件
                  </Button>
                </div>

                {moreFiltersOpen ? (
                  <div className="flex flex-col gap-5 rounded-xl border border-default-200/80 bg-default-50/60 p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
                      <StatsLabelField label="部门">
                        <Select
                          aria-label="部门"
                          size="sm"
                          variant="bordered"
                          classNames={{ trigger: 'min-h-10' }}
                          items={deptItems}
                          selectedKeys={
                            departmentId
                              ? new Set([departmentId])
                              : new Set([ALL_DEPT_KEY])
                          }
                          onSelectionChange={(keys) => {
                            const k = [...keys][0] as string | undefined
                            if (!k || k === ALL_DEPT_KEY) setDepartmentId('')
                            else setDepartmentId(k)
                          }}
                        >
                          {(item) => (
                            <SelectItem key={item.id} textValue={item.label}>
                              {item.label}
                            </SelectItem>
                          )}
                        </Select>
                      </StatsLabelField>

                      <StatsLabelField label="项目">
                        <Select
                          aria-label="项目"
                          size="sm"
                          variant="bordered"
                          classNames={{ trigger: 'min-h-10' }}
                          items={projItems}
                          selectedKeys={
                            projectId
                              ? new Set([projectId])
                              : new Set([ALL_PROJECT_KEY])
                          }
                          onSelectionChange={(keys) => {
                            const k = [...keys][0] as string | undefined
                            if (!k || k === ALL_PROJECT_KEY) setProjectId('')
                            else setProjectId(k)
                          }}
                        >
                          {(item) => (
                            <SelectItem key={item.id} textValue={item.label}>
                              {item.label}
                            </SelectItem>
                          )}
                        </Select>
                      </StatsLabelField>

                      <StatsLabelField label="后缀">
                        <Select
                          aria-label="扩展名"
                          size="sm"
                          variant="bordered"
                          classNames={{ trigger: 'min-h-10' }}
                          items={extItemsForSelect}
                          selectedKeys={new Set([extSelectKey])}
                          onSelectionChange={(keys) => {
                            const k = [...keys][0] as string | undefined
                            if (!k || k === 'all') {
                              setFileExt('')
                              return
                            }
                            if (k === 'custom') {
                              setFileExt((prev) => prev.trim() || '')
                              return
                            }
                            const preset = EXT_PRESETS.find((e) => e.key === k)
                            if (preset) setFileExt(preset.ext)
                          }}
                        >
                          {(item) => (
                            <SelectItem key={item.key} textValue={item.label}>
                              {item.label}
                            </SelectItem>
                          )}
                        </Select>
                      </StatsLabelField>
                    </div>

                    {extSelectKey === 'custom' ? (
                      <StatsLabelField label="其他">
                        <Input
                          aria-label="自定义扩展名"
                          size="sm"
                          variant="bordered"
                          placeholder="如 zip"
                          value={fileExt}
                          onValueChange={(v) =>
                            setFileExt(v.replace(/^\./, '').toLowerCase())
                          }
                          className="max-w-xs"
                          description="不含点号，小写"
                        />
                      </StatsLabelField>
                    ) : null}

                    <StatsLabelField label="来源" className="items-center">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-12">
                        <SegmentedToggle
                          aria-label="来源"
                          value={fileType}
                          onChange={setFileType}
                          options={SOURCE_SEGMENTS}
                        />
                        <Button
                          size="md"
                          variant="flat"
                          startContent={
                            <Icon
                              icon="lucide:rotate-ccw"
                              className="size-3.5"
                              aria-hidden
                            />
                          }
                          onPress={resetFilters}
                        >
                          重置
                        </Button>
                      </div>
                    </StatsLabelField>
                  </div>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </section>

        <section aria-label="搜索结果" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-default-200/80 pb-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                搜索结果
              </h2>
              <p className="mt-0.5 text-sm tabular-nums text-default-500">
                {result == null
                  ? '输入条件后点击搜索'
                  : result.estimatedTotalHits != null
                    ? `约 ${result.estimatedTotalHits} 条（本页 ${result.hits.length} 条）`
                    : `本页 ${result.hits.length} 条`}
                {result?.processingTimeMs != null
                  ? ` · ${result.processingTimeMs} ms`
                  : null}
              </p>
            </div>
          </div>

          {pending && !result ? (
            <div className="flex justify-center py-16">
              <Spinner label="检索中…" />
            </div>
          ) : result && result.hits.length === 0 ? (
            <p className="py-12 text-center text-default-500">无匹配结果</p>
          ) : result ? (
            <>
              <ol className="flex flex-col gap-4">
                {result.hits.map((hit, index) => (
                  <li key={hit.id}>
                    <article className="group relative overflow-hidden rounded-2xl border border-default-200/70 bg-content1/70 shadow-sm transition-all duration-200 hover:border-primary/25 hover:bg-content1 hover:shadow-md">
                      <div className="absolute inset-y-0 left-0 w-1 bg-primary/40 transition-colors group-hover:bg-primary" />
                      <div className="relative pl-5 pr-4 py-5 md:pl-6 md:pr-5">
                        <div className="flex flex-wrap items-start gap-3 md:gap-4">
                          <span
                            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-default-100 text-xs font-semibold tabular-nums text-default-500 group-hover:bg-primary/10 group-hover:text-primary"
                            aria-hidden
                          >
                            {(page - 1) * PAGE_SIZE + index + 1}
                          </span>
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-start gap-2 gap-y-1.5">
                              <FileTypeIcon
                                fileName={hit.file_name?.trim() || `file.${hit.file_ext ?? 'unknown'}`}
                                className="mt-1 size-5 shrink-0 object-contain"
                              />
                              <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug text-foreground md:text-[1.05rem]">
                                {displayFileName(hit)}
                              </h3>
                              {hit.project_name ? (
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  className="h-6 max-w-full bg-default-100/90 text-default-700"
                                >
                                  <span className="truncate">
                                    {hit.project_name}
                                  </span>
                                </Chip>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-default-500">
                              {hit.file_type ? (
                                <Chip size="sm" variant="bordered" className="h-5">
                                  {fileTypeLabel(hit.file_type)}
                                </Chip>
                              ) : null}
                              {hit.department_name ? (
                                <span>{hit.department_name}</span>
                              ) : null}
                              {hit.uploader_name ? (
                                <span className="inline-flex items-center gap-1">
                                  <Icon
                                    icon="lucide:user"
                                    className="size-3.5 opacity-70"
                                    aria-hidden
                                  />
                                  {hit.uploader_name}
                                </span>
                              ) : null}
                              {hit.created_at ? (
                                <span className="tabular-nums">
                                  {hit.created_at.slice(0, 19).replace('T', ' ')}
                                </span>
                              ) : null}
                              {hit.content_degraded ? (
                                <Chip size="sm" color="warning" variant="flat">
                                  仅文件名索引
                                </Chip>
                              ) : null}
                            </div>
                            <div className="rounded-xl border border-default-100 bg-default-50 px-3.5 py-3 text-sm leading-relaxed text-default-700 dark:bg-default-100/30 dark:text-default-600">
                              {displaySnippet(hit)}
                            </div>
                          </div>
                          <Link
                            href={`/files/${hit.id}/preview`}
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 hover:text-primary"
                            aria-label="查看"
                          >
                            <Icon icon="lucide:eye" className="size-4" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  </li>
                ))}
              </ol>
              {totalPages > 1 ? (
                <div className="flex justify-center pt-2">
                  <Pagination
                    showControls
                    size="sm"
                    page={page}
                    total={totalPages}
                    onChange={onPageChange}
                    isDisabled={pending || !query.trim()}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <p className="py-8 text-center text-sm text-default-500">
              暂无检索结果
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
