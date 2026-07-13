'use client'

import SearchableSelect from '@/components/common/searchable-select'
import { showResultError } from '@/core/client/errors'
import FileTypeIcon from '@/modules/files/components/upload/file-type-icon'
import { searchDocumentsAction } from '@/modules/files/search/actions'
import type {
  DocSearchHit,
  DocSearchMode,
  DocSearchResponse,
  DocSearchSnippet,
} from '@/modules/files/types'
import type { DeptOption } from '@/modules/stats/types'
import {
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Pagination,
  Spinner,
  Tooltip,
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
  sales_file: '销售资料',
  deliverable: '成果文件',
  reference_client: '客户资料',
  reference_internal: '内部资料',
  reference_public: '公开资料',
  reference_original: '项目成果文件',
  reference: '参考资料',
}

const SEARCH_MODES: {
  value: DocSearchMode
  label: string
  icon: string
}[] = [
  {
    value: 'hybrid',
    label: '综合',
    icon: 'lucide:layers-3',
  },
  {
    value: 'keyword',
    label: '关键词',
    icon: 'lucide:text-search',
  },
  {
    value: 'semantic',
    label: '语义',
    icon: 'lucide:sparkles',
  },
  {
    value: 'metadata',
    label: '文件信息',
    icon: 'lucide:tag',
  },
]

const SOURCE_OPTIONS = [
  { key: 'sales_file', label: '销售资料' },
  { key: 'deliverable', label: '成果文件' },
  { key: 'reference_client', label: '客户资料' },
  { key: 'reference_internal', label: '内部资料' },
  { key: 'reference_public', label: '公开资料' },
]

const EXT_OPTIONS = [
  { key: 'pdf', label: 'PDF' },
  { key: 'docx', label: 'Word' },
  { key: 'xlsx', label: 'Excel' },
  { key: 'pptx', label: 'PPT' },
  { key: 'txt', label: 'TXT' },
  { key: 'md', label: 'Markdown' },
  { key: 'csv', label: 'CSV' },
]

const MATCHED_BY_LABEL: Record<
  NonNullable<DocSearchHit['matched_by']>,
  string
> = {
  metadata: '文件信息',
  fulltext: '关键词',
  vector: '语义',
  hybrid: '综合',
}

export type FileSearchInitial = {
  q: string
  mode: DocSearchMode
  projectName: string
  departmentId: string
  fileType: string
  fileExt: string
}

function HighlightText({ html }: { html: string }) {
  const parts: ReactNode[] = []
  const re = /<em>([\s\S]*?)<\/em>/gi
  let last = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(html)) !== null) {
    if (m.index > last) parts.push(html.slice(last, m.index))
    parts.push(
      <em key={`${m.index}-h`} className="font-semibold not-italic text-primary">
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

function displaySnippetText(snippet: DocSearchSnippet) {
  const raw = snippet.formatted?.trim() || snippet.content?.trim() || ''
  if (raw.includes('<em>')) return <HighlightText html={raw} />
  return raw
}

function snippetLocation(snippet: DocSearchSnippet) {
  if (snippet.slide_no) return `第 ${snippet.slide_no} 页`
  if (snippet.page_no) return `第 ${snippet.page_no} 页`
  if (snippet.sheet_name) {
    const rows =
      snippet.row_start && snippet.row_end
        ? ` · ${snippet.row_start}-${snippet.row_end} 行`
        : ''
    return `${snippet.sheet_name}${rows}`
  }
  return `片段 ${snippet.chunk_index + 1}`
}

function fileTypeLabel(code: string | undefined) {
  if (!code) return ''
  return FILE_TYPE_LABEL[code] ?? code
}

function scoreText(hit: DocSearchHit) {
  const parts = [
    ['综合', hit.final_score],
    ['文件信息', hit.metadata_score],
    ['关键词', hit.keyword_score],
    ['语义', hit.vector_score],
  ]
    .filter(([, value]) => typeof value === 'number')
    .map(([label, value]) => `${label} ${Number(value).toFixed(3)}`)
  return parts.length ? parts.join(' / ') : '无分数'
}

function SearchModeDropdown({
  value,
  onChange,
}: {
  value: DocSearchMode
  onChange: (value: DocSearchMode) => void
}) {
  const current = SEARCH_MODES.find((item) => item.value === value) ?? SEARCH_MODES[0]

  return (
    <div className="flex h-6 items-center gap-2 pr-2">
      <Dropdown placement="bottom-start">
        <DropdownTrigger>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-small px-1.5 text-sm font-medium text-default-700 outline-none transition hover:bg-default-100 hover:text-foreground"
          >
            <Icon icon={current.icon} className="size-4 text-default-500" aria-hidden />
            <span className="whitespace-nowrap">{current.label}</span>
            <Icon icon="lucide:chevron-down" className="size-3.5 text-default-400" aria-hidden />
          </button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="检索模式"
          selectedKeys={new Set([value])}
          selectionMode="single"
          onAction={(key) => onChange(String(key) as DocSearchMode)}
        >
          {SEARCH_MODES.map((mode) => (
            <DropdownItem
              key={mode.value}
              startContent={<Icon icon={mode.icon} className="size-4" aria-hidden />}
            >
              {mode.label}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
      <span className="h-5 w-px bg-default-200" aria-hidden />
    </div>
  )
}

export default function FileSearchPageClient({
  departmentOptions,
  initialFilters,
}: {
  departmentOptions: DeptOption[]
  initialFilters: FileSearchInitial
}) {
  const router = useRouter()

  const [query, setQuery] = useState(initialFilters.q)
  const [mode, setMode] = useState<DocSearchMode>(initialFilters.mode)
  const [projectName, setProjectName] = useState(initialFilters.projectName)
  const [departmentId, setDepartmentId] = useState(initialFilters.departmentId)
  const [fileType, setFileType] = useState(initialFilters.fileType)
  const [fileExt, setFileExt] = useState(initialFilters.fileExt)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<DocSearchResponse | null>(null)
  const [pending, startTransition] = useTransition()

  const departmentSelectOptions = useMemo(
    () => departmentOptions.map((d) => ({ key: d.id, label: d.label })),
    [departmentOptions]
  )

  const filtersPayload = useMemo(() => {
    const f: Record<string, string | boolean> = {}
    if (projectName.trim()) f.project_name = projectName.trim()
    if (departmentId.trim()) f.department_id = departmentId.trim()
    if (fileType.trim()) f.file_type = fileType.trim()
    if (fileExt.trim()) f.file_ext = fileExt.trim().replace(/^\./, '')
    return f
  }, [projectName, departmentId, fileType, fileExt])

  const syncUrl = useCallback(
    (nextPage?: number) => {
      const p = new URLSearchParams()
      if (query.trim()) p.set('q', query.trim())
      if (mode !== 'hybrid') p.set('mode', mode)
      if (projectName.trim()) p.set('project_name', projectName.trim())
      if (departmentId.trim()) p.set('department_id', departmentId.trim())
      if (fileType.trim()) p.set('file_type', fileType.trim())
      if (fileExt.trim()) p.set('file_ext', fileExt.trim())
      if (nextPage && nextPage > 1) p.set('page', String(nextPage))
      const qs = p.toString()
      router.replace(qs ? `/files/search?${qs}` : '/files/search', {
        scroll: false,
      })
    },
    [departmentId, fileExt, fileType, mode, projectName, query, router]
  )

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
          mode,
          limit: PAGE_SIZE,
          offset,
          filters: filtersPayload,
          max_content_chars: 700,
        })

        if (!res.success) {
          showResultError(res, '检索失败')
          setResult(null)
          return
        }

        setResult(res.data)
        setPage(nextPage)
      })
    },
    [filtersPayload, mode, query]
  )

  const submitSearch = useCallback(() => {
    if (!query.trim()) {
      addToast({
        title: '请输入检索内容',
        description: '可以输入文件名、项目名称、正文关键词或自然语言问题。',
        color: 'warning',
      })
      return
    }
    syncUrl(1)
    runSearch(1)
  }, [query, runSearch, syncUrl])

  const resetFilters = useCallback(() => {
    setDepartmentId('')
    setProjectName('')
    setFileType('')
    setFileExt('')
  }, [])

  const totalPages = useMemo(() => {
    const total = result?.estimatedTotalHits
    if (total != null && total > 0) {
      return Math.max(1, Math.ceil(total / PAGE_SIZE))
    }
    return 1
  }, [result])

  const activeFilterCount = useMemo(
    () =>
      [departmentId, projectName, fileType, fileExt].filter((value) =>
        value.trim()
      ).length,
    [departmentId, fileExt, fileType, projectName]
  )

  useEffect(() => {
    setQuery(initialFilters.q)
    setMode(initialFilters.mode)
    setProjectName(initialFilters.projectName)
    setDepartmentId(initialFilters.departmentId)
    setFileType(initialFilters.fileType)
    setFileExt(initialFilters.fileExt)
  }, [initialFilters])

  useEffect(() => {
    if (initialFilters.q.trim()) runSearch(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            搜索文件
          </h1>
        </div>
        {result ? (
          <div className="text-sm tabular-nums text-default-500">
            共 {result.estimatedTotalHits ?? 0} 条
          </div>
        ) : null}
      </header>

      <section className="rounded-lg border border-default-200 bg-content1 p-3 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex min-h-12 items-center gap-2 rounded-xl border border-default-200 bg-background px-2.5 py-1.5 shadow-sm transition-with-background focus-within:border-primary/50 focus-within:bg-content1 focus-within:ring-4 focus-within:ring-primary/10">
            <SearchModeDropdown value={mode} onChange={setMode} />
            <input
              aria-label="检索内容"
              className="min-w-0 flex-1 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-default-400"
              placeholder="输入文件名、项目名称、正文关键词或自然语言问题"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitSearch()
              }}
            />
            <Button
              isIconOnly
              aria-label="搜索"
              className="size-9 min-w-9 shrink-0"
              color="primary"
              radius="full"
              isDisabled={!query.trim()}
              isLoading={pending}
              onPress={submitSearch}
            >
              <Icon icon="lucide:search" className="size-4" aria-hidden />
            </Button>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
            <SearchableSelect
              className="w-full md:w-44"
              classNames={{
                inputWrapper: 'h-9 min-h-9 border-default-200 bg-content1',
                listboxWrapper: 'max-h-72',
                popoverContent: 'p-1',
              }}
              emptyOptionLabel="全部部门"
              itemClassName="min-h-8 py-1 text-sm"
              options={departmentSelectOptions}
              placeholder="全部部门"
              size="sm"
              value={departmentId}
              variant="bordered"
              onChange={setDepartmentId}
            />
            <Input
              aria-label="项目名称"
              className="w-full md:w-80"
              classNames={{
                inputWrapper: 'h-9 min-h-9 border-default-200 bg-content1',
                input: 'text-sm',
              }}
              placeholder="项目名称或编号"
              size="sm"
              startContent={
                <Icon icon="lucide:briefcase-business" className="size-4 text-default-400" aria-hidden />
              }
              value={projectName}
              variant="bordered"
              onValueChange={setProjectName}
            />
            <SearchableSelect
              className="w-full md:w-40"
              classNames={{
                inputWrapper: 'h-9 min-h-9 border-default-200 bg-content1',
                listboxWrapper: 'max-h-72',
                popoverContent: 'p-1',
              }}
              emptyOptionLabel="全部类型"
              itemClassName="min-h-8 py-1 text-sm"
              options={SOURCE_OPTIONS}
              placeholder="全部类型"
              size="sm"
              value={fileType}
              variant="bordered"
              onChange={setFileType}
            />
            <div className="flex w-full gap-2 md:w-auto">
              <SearchableSelect
                className="min-w-0 flex-1 md:w-36"
                classNames={{
                  inputWrapper: 'h-9 min-h-9 border-default-200 bg-content1',
                  listboxWrapper: 'max-h-72',
                  popoverContent: 'p-1',
                }}
                emptyOptionLabel="全部格式"
                itemClassName="min-h-8 py-1 text-sm"
                options={EXT_OPTIONS}
                placeholder="全部格式"
                size="sm"
                value={fileExt}
                variant="bordered"
                onChange={setFileExt}
              />
              <Tooltip content="重置筛选">
                <Button
                  isIconOnly
                  className="h-9 min-w-9 shrink-0"
                  isDisabled={activeFilterCount === 0}
                  variant="flat"
                  onPress={resetFilters}
                >
                  <Icon icon="lucide:rotate-ccw" className="size-4" />
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">检索结果</h2>
            <p className="mt-0.5 text-sm text-default-500">
              {result ? `共 ${result.estimatedTotalHits ?? 0} 条` : '输入内容后开始检索'}
            </p>
          </div>
          {pending && result ? (
            <div className="flex items-center gap-2 text-sm text-default-500">
              <Spinner size="sm" />
              <span>更新中</span>
            </div>
          ) : null}
        </div>

        {pending && !result ? (
          <div className="flex justify-center rounded-lg border border-default-200 bg-content1 py-16">
            <Spinner label="检索中..." />
          </div>
        ) : result && result.hits.length === 0 ? (
          <div className="rounded-lg border border-default-200 bg-content1 py-16 text-center text-default-500">
            没有找到匹配文件
          </div>
        ) : result ? (
          <>
            <ol className="flex flex-col gap-3">
              {result.hits.map((hit, index) => (
                <li key={hit.id}>
                  <article className="rounded-lg border border-default-200 bg-content1 p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md">
                    <div className="flex gap-4">
                      <div className="hidden w-8 shrink-0 pt-1 text-right text-sm tabular-nums text-default-400 sm:block">
                        {(page - 1) * PAGE_SIZE + index + 1}
                      </div>
                      <FileTypeIcon
                        className="mt-1 size-6 shrink-0 object-contain"
                        fileName={hit.file_name?.trim() || `file.${hit.file_ext ?? 'unknown'}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start gap-2">
                          <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug text-foreground">
                            {displayFileName(hit)}
                          </h3>
                          {hit.matched_by ? (
                            <Tooltip content={scoreText(hit)}>
                              <Chip size="sm" color="primary" variant="flat">
                                {MATCHED_BY_LABEL[hit.matched_by]}
                              </Chip>
                            </Tooltip>
                          ) : null}
                          {hit.is_confidential ? (
                            <Chip size="sm" color="warning" variant="flat">
                              保密
                            </Chip>
                          ) : null}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-default-500">
                          {hit.project_name ? <span>{hit.project_name}</span> : null}
                          {hit.department_name ? <span>{hit.department_name}</span> : null}
                          {hit.project_stage ? <span>{hit.project_stage}</span> : null}
                          {hit.file_type ? <span>{fileTypeLabel(hit.file_type)}</span> : null}
                          {hit.uploader_name ? <span>上传人：{hit.uploader_name}</span> : null}
                          {hit.created_at ? (
                            <span className="tabular-nums">
                              {hit.created_at.slice(0, 10)}
                            </span>
                          ) : null}
                        </div>

                        {hit.can_access_content === false ? (
                          <div className="mt-3 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-700 dark:border-warning-900/40 dark:bg-warning-950/30 dark:text-warning-300">
                            {hit.disabled_reason ?? '无内容权限，不能预览或下载'}
                          </div>
                        ) : hit.snippets?.length ? (
                          <div className="mt-3 space-y-2">
                            {hit.snippets.slice(0, 3).map((snippet) => (
                              <div
                                key={`${hit.id}-${snippet.chunk_index}`}
                                className="rounded-md bg-default-50 px-3 py-2 text-sm leading-relaxed text-default-700 dark:bg-default-100/30"
                              >
                                <div className="mb-1 flex items-center gap-1.5 text-xs text-default-400">
                                  <Icon icon="lucide:map-pin" className="size-3" />
                                  <span>{snippetLocation(snippet)}</span>
                                </div>
                                <div>{displaySnippetText(snippet)}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 rounded-md bg-default-50 px-3 py-2 text-sm text-default-500 dark:bg-default-100/30">
                            文件信息匹配，暂无正文片段
                          </div>
                        )}
                      </div>

                      {hit.can_access_content === false ? (
                        <Tooltip content={hit.disabled_reason ?? '无内容权限'}>
                          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-default-300">
                            <Icon icon="lucide:lock" className="size-4" />
                          </span>
                        </Tooltip>
                      ) : (
                        <Tooltip content="预览文件">
                          <Link
                            aria-label="预览文件"
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-primary transition hover:bg-primary/10"
                            href={`/files/${hit.id}/preview`}
                          >
                            <Icon icon="lucide:eye" className="size-4" />
                          </Link>
                        </Tooltip>
                      )}
                    </div>
                  </article>
                </li>
              ))}
            </ol>

            {totalPages > 1 ? (
              <div className="flex justify-center pt-2">
                <Pagination
                  showControls
                  isDisabled={pending || !query.trim()}
                  page={page}
                  size="sm"
                  total={totalPages}
                  onChange={(nextPage) => {
                    syncUrl(nextPage)
                    runSearch(nextPage)
                  }}
                />
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-default-200 bg-content1 py-16 text-center text-sm text-default-500">
            支持按文件信息、正文关键词和语义进行检索。
          </div>
        )}
      </section>
    </div>
  )
}
