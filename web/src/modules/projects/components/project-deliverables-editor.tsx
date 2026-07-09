'use client'

import { useState } from 'react'
import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  addToast,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import { randomClientId } from '@/core/random-client-id'
import { showErrorToast, showResultError } from '@/core/client/errors'
import { saveProjectDeliverables } from '@/modules/projects/actions'
import type { DeliverableRow } from '@/modules/projects/types'

interface Row {
  key: string
  id?: string
  name: string
  description: string
}

function withUiTimeout<T>(promise: Promise<T>, timeoutMs = 8000): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => resolve(null), timeoutMs)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      }
    )
  })
}

export default function ProjectDeliverablesEditor({
  projectId,
  initialRows,
}: {
  projectId: string
  initialRows: DeliverableRow[]
}) {
  const [rows, setRows] = useState<Row[]>(
    initialRows.map((row) => ({
      key: row.id,
      id: row.id,
      name: row.name,
      description: row.description ?? '',
    }))
  )
  const [isSaving, setIsSaving] = useState(false)

  const patchRow = (key: string, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row))
    )

  const addRow = () =>
    setRows((current) => [
      ...current,
      { key: randomClientId(), name: '', description: '' },
    ])

  const removeRow = (key: string) =>
    setRows((current) => current.filter((row) => row.key !== key))

  const save = async () => {
    setIsSaving(true)
    try {
      const result = await withUiTimeout(
        saveProjectDeliverables({
          project_id: projectId,
          items: rows
            .filter((row) => row.name.trim())
            .map((row) => ({
              id: row.id,
              name: row.name.trim(),
              description: row.description.trim() || null,
            })),
        })
      )
      if (result == null) {
        addToast({
          title: '保存请求已提交',
          description: '服务器响应较慢，页面已恢复可编辑；刷新后可查看最终结果。',
          color: 'warning',
          timeout: 3000,
        })
        return
      }
      if (!result.success) {
        showResultError(result, '保存失败')
        return
      }
      setRows(
        result.data.deliverables.map((row) => ({
          key: row.id,
          id: row.id,
          name: row.name,
          description: row.description ?? '',
        }))
      )
      addToast({ title: '成果清单已保存', color: 'success', timeout: 1600 })
    } catch (error) {
      showErrorToast({ title: '保存失败', error })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">成果清单</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="flat"
            startContent={<Icon icon="lucide:plus" className="size-4" aria-hidden />}
            onPress={addRow}
            isDisabled={isSaving}
          >
            添加
          </Button>
          <Button color="primary" size="sm" onPress={save} isLoading={isSaving}>
            保存
          </Button>
        </div>
      </div>

      <Table aria-label="成果清单" classNames={{ wrapper: 'overflow-x-auto' }}>
        <TableHeader>
          <TableColumn>成果名称</TableColumn>
          <TableColumn>描述</TableColumn>
          <TableColumn align="end">操作</TableColumn>
        </TableHeader>
        <TableBody emptyContent={<div className="text-default-400 py-8">暂无成果项</div>}>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>
                <Input
                  size="sm"
                  variant="bordered"
                  value={row.name}
                  onValueChange={(value) => patchRow(row.key, { name: value })}
                  placeholder="成果名称"
                  isDisabled={isSaving}
                />
              </TableCell>
              <TableCell>
                <Input
                  size="sm"
                  variant="bordered"
                  value={row.description}
                  onValueChange={(value) =>
                    patchRow(row.key, { description: value })
                  }
                  placeholder="描述"
                  isDisabled={isSaving}
                />
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="light"
                    color="danger"
                    isIconOnly
                    aria-label="删除成果项"
                    onPress={() => removeRow(row.key)}
                    isDisabled={isSaving}
                  >
                    <Icon icon="lucide:trash-2" className="size-4" aria-hidden />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
