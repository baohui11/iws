'use client'

import { Tab, Tabs } from '@heroui/react'
import type {
  ExcelPreviewCell,
  ExcelPreviewJson,
  ExcelPreviewSheet,
} from '@/types/file-preview'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function SheetTable({ sheet }: { sheet: ExcelPreviewSheet }) {
  const rows = sheet.rows
  if (rows?.length) {
    const colCount = Math.max(...rows.map((r) => (Array.isArray(r) ? r.length : 0)))
    return (
      <div className="max-h-[min(65vh,640px)] overflow-auto rounded-lg border border-default-200">
        <table className="w-full min-w-[480px] border-collapse text-xs">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-default-100">
                {Array.from({ length: colCount }, (_, ci) => {
                  const cell: ExcelPreviewCell | undefined = Array.isArray(row)
                    ? row[ci]
                    : undefined
                  let style: Record<string, string> = {}
                  let v = ''
                  if (cell === null || cell === undefined) {
                    v = ''
                  } else if (typeof cell === 'string' || typeof cell === 'number') {
                    v = String(cell)
                  } else if (isRecord(cell) && 'v' in cell) {
                    const rich = cell as {
                      v?: string | number | null
                      style?: Record<string, string>
                    }
                    v = String(rich.v ?? '')
                    if (isRecord(rich.style)) {
                      style = rich.style as Record<string, string>
                    }
                  } else {
                    v = String(cell)
                  }
                  return (
                    <td
                      key={ci}
                      className="border border-default-200 px-2 py-1 align-top"
                      style={style}
                    >
                      {v}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const cells = sheet.cells
  if (cells?.length) {
    let maxR = 0
    let maxC = 0
    for (const c of cells) {
      maxR = Math.max(maxR, c.r)
      maxC = Math.max(maxC, c.c)
    }
    const grid: (string | undefined)[][] = Array.from({ length: maxR + 1 }, () =>
      Array.from({ length: maxC + 1 }, () => undefined)
    )
    for (const c of cells) {
      if (grid[c.r]?.[c.c] !== undefined) continue
      grid[c.r]![c.c] = c.v != null ? String(c.v) : ''
    }
    return (
      <div className="max-h-[min(65vh,640px)] overflow-auto rounded-lg border border-default-200">
        <table className="w-full border-collapse text-xs">
          <tbody>
            {grid.map((row, ri) => (
              <tr key={ri} className="border-b border-default-100">
                {row.map((cell, ci) => (
                  <td key={ci} className="border border-default-200 px-2 py-1">
                    {cell ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return <p className="text-sm text-default-500">该工作表无行列数据</p>
}

export function PreviewExcel({ data }: { data: unknown }) {
  const parsed = data as unknown
  if (!isRecord(parsed)) {
    return (
      <pre className="max-h-[min(60vh,560px)] overflow-auto rounded-lg bg-default-100 p-4 text-xs">
        {JSON.stringify(data, null, 2)}
      </pre>
    )
  }

  const asExcel = parsed as ExcelPreviewJson
  if (Array.isArray(asExcel.sheets) && asExcel.sheets.length > 0) {
    const sheets = asExcel.sheets
    return (
      <Tabs aria-label="工作表">
        {sheets.map((sh, i) => (
          <Tab key={i} title={sh.name?.trim() || `表 ${i + 1}`}>
            <div className="pt-3">
              <SheetTable sheet={sh} />
            </div>
          </Tab>
        ))}
      </Tabs>
    )
  }

  if (Array.isArray(asExcel.rows) && asExcel.rows.length > 0) {
    return (
      <SheetTable sheet={{ rows: asExcel.rows }} />
    )
  }

  return (
    <pre className="max-h-[min(60vh,560px)] overflow-auto rounded-lg bg-default-100 p-4 text-xs">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}
