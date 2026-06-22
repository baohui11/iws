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
    return <p className="text-sm text-default-500">无数据</p>
  }
  const colCount = Math.max(...rows.map((r) => r.length))
  const cols = Array.from({ length: colCount }, (_, i) => `c${i}`)

  return (
    <div className="space-y-2">
      {truncated ? (
        <p className="text-xs text-warning-600">
          仅展示前 {rows.length} 行、前若干列，完整内容请使用本地工具打开原文件。
        </p>
      ) : null}
      <div className="max-h-[min(70vh,720px)] overflow-auto rounded-lg border border-default-200">
        <Table
          aria-label="CSV 预览"
          removeWrapper
          classNames={{
            wrapper: 'min-w-full',
            th: 'bg-default-100/80 px-2 py-1.5 text-xs',
            td: 'border-b border-default-100 px-2 py-1.5 text-xs max-w-[min(240px,40vw)]',
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
