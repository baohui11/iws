'use client'

import { showResultError } from '@/core/client/errors'
import {
  Button,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  StatsDepartmentSelect,
  StatsFilterBar,
  StatsTextFilter,
  useDebouncedValue,
} from '@/modules/stats/components/shared/stats-filter-controls'
import { loadFilesStatsPageAction } from '@/modules/stats/actions'
import type { FileStatsRow } from '@/modules/stats/types'
import { formatFileSize } from '@/modules/files/lib/format-file-size'
import { referenceFileSourceLabel } from '@/modules/files/lib/reference-file-source'
import { ExportCsvButton } from '@/modules/stats/components/shared/export-csv-button'
import type { DeptOption } from '@/modules/stats/types'

const PAGE_SIZE = 50

export default function FilesStatsClient({
  departmentOptions,
  initialDepartmentId,
}: {
  departmentOptions: DeptOption[]
  initialDepartmentId: string
}) {
  const [rows, setRows] = useState<FileStatsRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [departmentId, setDepartmentId] = useState(initialDepartmentId)
  const [fileKw, setFileKw] = useState('')
  const [projectKw, setProjectKw] = useState('')
  const debouncedFileKw = useDebouncedValue(fileKw)
  const debouncedProjectKw = useDebouncedValue(projectKw)

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      if (offset === 0) setLoading(true)
      else setLoadingMore(true)

      const result = await loadFilesStatsPageAction(
        departmentId,
        debouncedFileKw.trim() || null,
        debouncedProjectKw.trim() || null,
        offset,
        PAGE_SIZE
      )

      if (offset === 0) setLoading(false)
      else setLoadingMore(false)

      if (!result.success) {
        showResultError(result, '加载失败')
        if (!append) setRows([])
        return
      }

      const page = result.data
      setTotal(page.total)
      if (append) {
        setRows((prev) => [...prev, ...page.rows])
      } else {
        setRows(page.rows)
      }
    },
    [debouncedFileKw, debouncedProjectKw, departmentId]
  )

  useEffect(() => {
    void fetchPage(0, false)
  }, [fetchPage])

  const hasMore = rows.length < total

  const csv = useMemo(() => {
    const headers = [
      '文件名',
      '大小',
      '扩展名',
      '上传时间',
      '上传者',
      '项目名称',
      '部门',
      '成果文件',
      '敏感',
      '文件来源',
    ]
    const body = rows.map((r) => [
      r.file_name,
      String(r.file_size),
      r.file_ext ?? '—',
      r.created_at,
      r.uploader_name ?? '—',
      r.project_name ?? '—',
      r.department_label,
      r.is_deliverable ? '是' : '否',
      r.is_confidential ? '是' : '否',
      referenceFileSourceLabel(r.file_source),
    ])
    return { headers, body }
  }, [rows])

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold tracking-tight">文件统计</h1>

      <StatsFilterBar>
        <StatsDepartmentSelect
          value={departmentId}
          onChange={setDepartmentId}
          departmentOptions={departmentOptions}
          includeAll={departmentOptions.length > 1}
        />
        <StatsTextFilter
          label="文件"
          value={fileKw}
          onChange={setFileKw}
          placeholder="名称模糊"
        />
        <StatsTextFilter
          label="项目"
          value={projectKw}
          onChange={setProjectKw}
          placeholder="名称模糊"
        />
      </StatsFilterBar>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-default-500">
          共 {total} 条{hasMore ? `，已加载 ${rows.length} 条` : ''}
        </p>
        <ExportCsvButton
          filename="文件统计.csv"
          headers={csv.headers}
          rows={csv.body}
          disabled={loading || rows.length === 0}
        />
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-16">
          <Spinner label="加载中…" />
        </div>
      ) : (
        <div className="max-h-[min(75vh,800px)] overflow-auto rounded-lg border border-default-200/80">
          <Table
            aria-label="文件统计"
            removeWrapper
            classNames={{
              wrapper: 'min-w-[1280px]',
              th: 'bg-default-100/80 px-3 py-2 text-xs text-default-600 whitespace-nowrap sticky top-0 z-10',
              td: 'border-b border-default-100 px-3 py-2 text-sm',
            }}
          >
            <TableHeader>
              <TableColumn>文件名</TableColumn>
              <TableColumn>大小</TableColumn>
              <TableColumn>上传时间</TableColumn>
              <TableColumn>上传者</TableColumn>
              <TableColumn>项目</TableColumn>
              <TableColumn>部门</TableColumn>
              <TableColumn>成果</TableColumn>
              <TableColumn>敏感</TableColumn>
              <TableColumn>文件来源</TableColumn>
            </TableHeader>
            <TableBody emptyContent="暂无数据">
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="min-w-[280px] max-w-[min(560px,60vw)] font-medium">
                    <span className="line-clamp-2 break-all">{r.file_name}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-default-600">
                    {formatFileSize(r.file_size)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-default-600">
                    {r.created_at?.slice(0, 19)?.replace('T', ' ') ?? '—'}
                  </TableCell>
                  <TableCell className="min-w-[72px]">{r.uploader_name ?? '—'}</TableCell>
                  <TableCell className="min-w-[220px] max-w-[min(480px,50vw)]">
                    <span className="line-clamp-2">{r.project_name ?? '—'}</span>
                  </TableCell>
                  <TableCell className="min-w-[140px] max-w-[min(280px,35vw)]">
                    {r.department_label}
                  </TableCell>
                  <TableCell>{r.is_deliverable ? '是' : '否'}</TableCell>
                  <TableCell>{r.is_confidential ? '是' : '否'}</TableCell>
                  <TableCell>{referenceFileSourceLabel(r.file_source)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {hasMore && rows.length > 0 ? (
        <div className="flex justify-center">
          <Button
            variant="bordered"
            size="sm"
            isLoading={loadingMore}
            onPress={() => void fetchPage(rows.length, true)}
          >
            加载更多
          </Button>
        </div>
      ) : null}
    </div>
  )
}
