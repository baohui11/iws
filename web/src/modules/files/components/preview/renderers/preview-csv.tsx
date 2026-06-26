'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'

export function PreviewCsv({
  rows,
  truncated,
}: {
  rows: string[][]
  truncated: boolean
}) {
  if (!rows.length) {
    return <p className="p-6 text-sm text-default-500">无数据</p>
  }

  const colCount = Math.max(...rows.map((r) => r.length))
  const cols = Array.from({ length: colCount }, (_, i) => `C${i + 1}`)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {truncated ? (
        <p className="border-b border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-700">
          仅展示前 {rows.length} 行和部分列，完整内容请下载原文件查看。
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto bg-content1">
        <Table
          aria-label="CSV 预览"
          removeWrapper
          classNames={{
            wrapper: 'min-w-full',
            th: 'bg-default-100/90 px-2 py-1.5 text-xs',
            td: 'border-b border-default-100 px-2 py-1.5 text-xs max-w-[min(280px,44vw)]',
          }}
        >
          <TableHeader>
            {cols.map((c) => (
              <TableColumn key={c}>{c}</TableColumn>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row, ri) => (
              <TableRow key={ri}>
                {cols.map((_, ci) => (
                  <TableCell key={ci}>
                    <span className="line-clamp-4 break-all">
                      {row[ci] ?? ''}
                    </span>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
