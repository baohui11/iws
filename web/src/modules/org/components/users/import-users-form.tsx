'use client'

import { useState, useRef } from 'react'
import { Button, addToast } from '@heroui/react'
import { Icon, addCollection } from '@iconify/react'
import solarIcons from '@iconify-json/solar/icons.json'
import Link from 'next/link'
import { importUsers } from '@/modules/org/users/actions'
import { parseUsersCsv } from '@/modules/org/users/csv'

addCollection(solarIcons as Parameters<typeof addCollection>[0])

export default function ImportUsersForm() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, setIsPending] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewCount, setPreviewCount] = useState<number | null>(null)

  const handleFile = async (file: File | null) => {
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    const rows = parseUsersCsv(text)
    setPreviewCount(rows.length)
  }

  const handleSubmit = async () => {
    const file = inputRef.current?.files?.[0]
    if (!file) {
      addToast({
        title: '请选择文件',
        description: '请先选择 CSV 文件',
        color: 'warning',
      })
      return
    }

    const text = await file.text()
    const rows = parseUsersCsv(text)
    if (rows.length === 0) {
      addToast({
        title: '无有效数据',
        description: '请检查 CSV 是否包含表头与至少一行数据',
        color: 'warning',
      })
      return
    }

    setIsPending(true)
    const result = await importUsers(rows)
    setIsPending(false)

    if (result.success && result.data) {
      const { succeeded, failed, total, results } = result.data
      addToast({
        title: '导入完成',
        description: `共 ${total} 条，成功 ${succeeded}，失败 ${failed}`,
        color: failed > 0 ? 'warning' : 'success',
        timeout: 4000,
      })
      if (failed > 0) {
        const detail = results
          .filter((r) => !r.success)
          .slice(0, 5)
          .map((r) => `${r.email}: ${r.message}`)
          .join('；')
        addToast({
          title: '部分失败',
          description: detail + (failed > 5 ? '…' : ''),
          color: 'danger',
          timeout: 8000,
        })
      }
      if (inputRef.current) inputRef.current.value = ''
      setFileName(null)
      setPreviewCount(null)
    } else {
      addToast({
        title: '导入失败',
        description: result.success ? undefined : result.message,
        color: 'danger',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-medium border-divider bg-content2/40 text-foreground/80 border p-4 text-sm">
        <p className="text-foreground mb-2 font-medium">CSV 格式说明</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>导入仅写入<strong>用户表</strong>，不创建登录账号。</li>
          <li>
            第一行为表头，编码请使用 UTF-8（Excel 导出后可用记事本另存为 UTF-8）。
          </li>
          <li>
            必填列：<code className="text-primary">email</code>、
            <code className="text-primary">name</code>、
            <code className="text-primary">employee_no</code>、
            <code className="text-primary">gender</code>、
            <code className="text-primary">position</code>
          </li>
          <li>
            部门：<code className="text-primary">department_id</code>（UUID）与{' '}
            <code className="text-primary">department_name</code>（名称）二选一必填；同时填写时优先
            department_id。
          </li>
          <li>
            可选列：<code className="text-primary">role</code>（默认 user）
          </li>
          <li>表头也支持中文：邮箱、姓名、工号、性别、部门id、部门名称、职位、角色。</li>
        </ul>
        <p className="text-default-500 mt-3 text-xs">
          示例：email,name,employee_no,gender,department_name,position,role
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
        <Button
          variant="bordered"
          startContent={<Icon icon="solar:folder-with-files-linear" />}
          onPress={() => inputRef.current?.click()}
        >
          选择 CSV 文件
        </Button>
        {fileName ? (
          <span className="text-default-600 text-sm">
            {fileName}
            {previewCount !== null ? `（${previewCount} 行）` : ''}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          color="primary"
          isLoading={isPending}
          isDisabled={!fileName}
          onPress={() => void handleSubmit()}
        >
          开始导入
        </Button>
        <Button as={Link} href="/admin/users" variant="flat">
          返回用户列表
        </Button>
      </div>
    </div>
  )
}
