'use client'

import { useState, useRef } from 'react'
import { Button, addToast } from '@heroui/react'
import { Icon, addCollection } from '@iconify/react'
import solarIcons from '@iconify-json/solar/icons.json'
import Link from 'next/link'
import { importUsers } from '@/actions/admin/users.action'
import { parseUsersCsv } from '@/lib/csv/parse-users-csv'

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
      addToast({ title: '请选择文件', description: '请先选择 CSV 文件', color: 'warning' })
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
        description: result.message ?? '操作失败',
        color: 'danger',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-medium border border-divider bg-content2/40 p-4 text-sm text-foreground/80">
        <p className="font-medium text-foreground mb-2">CSV 格式说明</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            导入仅写入<strong>业务用户表</strong>（public.users），不创建 Auth 账号、不发送邀请；可在用户列表中单独或批量邀请开通登录。
          </li>
          <li>第一行为表头，编码请使用 UTF-8（Excel 导出后可用记事本另存为 UTF-8）。</li>
          <li>
            必填列：<code className="text-primary">email</code>、
            <code className="text-primary">name</code>、
            <code className="text-primary">employee_no</code>、
            <code className="text-primary">gender</code>、
            <code className="text-primary">position</code>
          </li>
          <li>
            部门：<code className="text-primary">department_id</code>（部门 UUID）与{' '}
            <code className="text-primary">department_name</code>（部门名称）二选一必填；若同时填写则优先使用
            department_id。
          </li>
          <li>
            可选列：<code className="text-primary">role</code>（默认 user）
          </li>
          <li>
            <code className="text-primary">department_name</code> 与系统中部门名称（name）完全一致方可匹配。
          </li>
          <li>
            表头也支持中文：邮箱、姓名、工号、性别、部门id、部门名称、职位、角色。
          </li>
        </ul>
        <p className="mt-3 text-xs text-default-500">
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
          <span className="text-sm text-default-600">
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
