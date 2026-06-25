'use client'

import { Button } from '@heroui/react'
import { Icon } from '@iconify/react'
import { downloadCsvFile, rowsToCsvString } from '@/modules/stats/lib/csv-export'

export function ExportCsvButton({
  filename,
  headers,
  rows,
  disabled,
}: {
  filename: string
  headers: string[]
  rows: string[][]
  disabled?: boolean
}) {
  return (
    <Button
      size="sm"
      variant="bordered"
      className="border-default-200"
      isDisabled={disabled || rows.length === 0}
      startContent={<Icon icon="lucide:download" className="size-4" aria-hidden />}
      onPress={() => {
        const csv = rowsToCsvString(headers, rows)
        downloadCsvFile(filename, csv)
      }}
    >
      导出 CSV
    </Button>
  )
}
