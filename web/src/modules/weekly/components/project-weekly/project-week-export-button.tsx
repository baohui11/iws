'use client'

import { useState } from 'react'
import { Button, addToast } from '@heroui/react'
import { Icon } from '@iconify/react'

import { exportProjectWeekExcelAction } from '@/modules/weekly/project-weekly/actions'
import { showErrorToast, showResultError } from '@/core/client/errors'

export default function ProjectWeekExportButton({
  projectId,
  weekCode,
}: {
  projectId: string
  weekCode: string
}) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const result = await exportProjectWeekExcelAction({ projectId, weekCode })
      if (result.success && result.data) {
        const { fileName, fileContent } = result.data
        const binary = atob(fileContent)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        const blob = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        URL.revokeObjectURL(url)
        addToast({
          title: '导出成功',
          color: 'success',
          timeout: 2000,
        })
      } else if (!result.success) {
        showResultError(result, '导出失败')
      }
    } catch (error) {
      showErrorToast({
        title: '导出失败',
        error,
        fallbackMessage: '网络错误，请稍后重试',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      color="primary"
      variant="flat"
      size="sm"
      isLoading={loading}
      startContent={
        !loading ? (
          <Icon className="text-lg" icon="solar:document-text-bold" />
        ) : null
      }
      onPress={handleExport}
    >
      导出 Excel
    </Button>
  )
}
