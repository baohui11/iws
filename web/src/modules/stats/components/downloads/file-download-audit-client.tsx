'use client'

import {
  Button,
  DateRangePicker,
  Input,
  Pagination,
  Spinner,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import { getLocalTimeZone, today, type DateValue } from '@internationalized/date'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  loadFileDownloadByPersonAction,
  loadFileDownloadDetailsAction,
} from '@/modules/stats/actions'
import { showResultError } from '@/core/client/errors'
import { StatsLabelField } from '@/modules/stats/components/shared/stats-label-field'
import type {
  FileDownloadByPersonRow,
  FileDownloadDetailRow,
} from '@/modules/stats/types'

const DETAILS_PAGE_SIZE = 50

type DateRange = { start: DateValue; end: DateValue }

function defaultDateRange(): DateRange {
  const end = today(getLocalTimeZone())
  const start = end.subtract({ days: 30 })
  return { start, end }
}

function formatDownloadAt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 19)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function FileDownloadAuditClient() {
  const initial = useMemo(() => defaultDateRange(), [])
  const [dateRange, setDateRange] = useState<DateRange>(initial)
  const [nameKw, setNameKw] = useState('')

  const dateFrom = dateRange.start.toString()
  const dateTo = dateRange.end.toString()

  const [byPerson, setByPerson] = useState<FileDownloadByPersonRow[]>([])
  const [details, setDetails] = useState<FileDownloadDetailRow[]>([])
  const [detailsTotal, setDetailsTotal] = useState(0)
  const [detailsPage, setDetailsPage] = useState(1)

  const [loadingPerson, setLoadingPerson] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const fetchPerson = useCallback(async () => {
    setLoadingPerson(true)
    const res = await loadFileDownloadByPersonAction({
      dateFrom,
      dateTo,
      nameKeyword: nameKw.trim() || null,
    })
    setLoadingPerson(false)
    if (!res.success) {
      showResultError(res, '加载失败')
      setByPerson([])
      return
    }
    setByPerson(res.data)
  }, [dateFrom, dateTo, nameKw])

  const fetchDetails = useCallback(
    async (page: number) => {
      setLoadingDetails(true)
      const offset = (page - 1) * DETAILS_PAGE_SIZE
      const res = await loadFileDownloadDetailsAction({
        dateFrom,
        dateTo,
        nameKeyword: nameKw.trim() || null,
        offset,
        limit: DETAILS_PAGE_SIZE,
      })
      setLoadingDetails(false)
      if (!res.success) {
        showResultError(res, '加载失败')
        setDetails([])
        setDetailsTotal(0)
        return
      }
      setDetails(res.data.rows)
      setDetailsTotal(res.data.total)
      setDetailsPage(page)
    },
    [dateFrom, dateTo, nameKw]
  )

  const runSearch = useCallback(() => {
    void fetchPerson()
    void fetchDetails(1)
  }, [fetchPerson, fetchDetails])

  useEffect(() => {
    void fetchPerson()
    void fetchDetails(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const detailsTotalPages = Math.max(
    1,
    Math.ceil(detailsTotal / DETAILS_PAGE_SIZE)
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-default-200/80 bg-default-50/50 p-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4 lg:gap-y-2">
          <StatsLabelField label="日期" className="lg:min-w-[min(100%,32rem)]">
            <DateRangePicker
              aria-label="日期范围"
              size="sm"
              variant="bordered"
              value={dateRange}
              onChange={(r) => {
                if (r?.start && r?.end)
                  setDateRange({ start: r.start, end: r.end })
              }}
              granularity="day"
              visibleMonths={2}
              className="w-full min-w-[18rem] max-w-[36rem]"
            />
          </StatsLabelField>

          <StatsLabelField label="姓名" className="lg:min-w-[min(100%,20rem)]">
            <Input
              aria-label="姓名模糊"
              size="sm"
              variant="bordered"
              placeholder="模糊"
              value={nameKw}
              onValueChange={setNameKw}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch()
              }}
              className="w-full min-w-[12rem] max-w-[20rem]"
            />
          </StatsLabelField>

          <div className="flex w-full justify-end lg:ml-auto lg:w-auto">
            <Button
              color="primary"
              size="sm"
              className="font-medium"
              startContent={
                <Icon icon="lucide:search" className="size-4" aria-hidden />
              }
              onPress={runSearch}
            >
              查询
            </Button>
          </div>
        </div>
      </div>

      <Tabs
        aria-label="文件下载统计"
        classNames={{ panel: 'pt-4' }}
        variant="underlined"
        color="primary"
      >
        <Tab key="by-person" title="按人员统计">
          {loadingPerson ? (
            <div className="flex justify-center py-12">
              <Spinner label="加载中…" />
            </div>
          ) : (
            <Table aria-label="按人员下载次数" removeWrapper>
              <TableHeader>
                <TableColumn>姓名</TableColumn>
                <TableColumn align="end">下载次数</TableColumn>
              </TableHeader>
              <TableBody emptyContent="暂无数据">
                {byPerson.map((r) => (
                  <TableRow key={r.user_id ?? 'null'}>
                    <TableCell>{r.user_name}</TableCell>
                    <TableCell className="tabular-nums text-end">
                      {r.download_count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Tab>
        <Tab key="details" title="下载明细">
          {loadingDetails ? (
            <div className="flex justify-center py-12">
              <Spinner label="加载中…" />
            </div>
          ) : (
            <div className="space-y-4">
              <Table aria-label="下载明细" removeWrapper>
                <TableHeader>
                  <TableColumn>下载时间</TableColumn>
                  <TableColumn>人员</TableColumn>
                  <TableColumn>文件名</TableColumn>
                  <TableColumn>IP</TableColumn>
                </TableHeader>
                <TableBody emptyContent="暂无数据">
                  {details.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDownloadAt(r.downloaded_at)}
                      </TableCell>
                      <TableCell>{r.user_name ?? '—'}</TableCell>
                      <TableCell className="max-w-[min(28rem,40vw)] truncate text-sm">
                        {r.file_name ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs text-default-500">
                        {r.ip_address ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {detailsTotal > 0 ? (
                <div className="flex justify-center">
                  <Pagination
                    showControls
                    size="sm"
                    page={detailsPage}
                    total={detailsTotalPages}
                    onChange={(p) => void fetchDetails(p)}
                  />
                </div>
              ) : null}
            </div>
          )}
        </Tab>
      </Tabs>
    </div>
  )
}
