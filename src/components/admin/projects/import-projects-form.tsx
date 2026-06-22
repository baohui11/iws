'use client'

import { useState, useRef } from 'react'
import { Button, addToast } from '@heroui/react'
import { Icon, addCollection } from '@iconify/react'
import Link from 'next/link'
import solarIcons from '@iconify-json/solar/icons.json'
import { importProjects } from '@/actions/admin/projects.action'
import { parseProjectsCsv } from '@/lib/csv/parse-projects-csv'

addCollection(solarIcons as Parameters<typeof addCollection>[0])

export default function ImportProjectsForm() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, setIsPending] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewCount, setPreviewCount] = useState<number | null>(null)

  const handleFile = async (file: File | null) => {
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    const rows = parseProjectsCsv(text)
    setPreviewCount(rows.length)
  }

  const handleSubmit = async () => {
    const file = inputRef.current?.files?.[0]
    if (!file) {
      addToast({ title: '请选择文件', description: '请先选择 CSV 文件', color: 'warning' })
      return
    }

    const text = await file.text()
    const rows = parseProjectsCsv(text)
    if (rows.length === 0) {
      addToast({
        title: '无有效数据',
        description: '请检查 CSV 是否包含表头与至少一行数据',
        color: 'warning',
      })
      return
    }

    setIsPending(true)
    const result = await importProjects(rows)
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
          .map((r) => `${r.project_no}: ${r.message}`)
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
        <p className="mb-2 font-medium text-foreground">CSV 格式说明</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>第一行为表头，编码请使用 UTF-8。</li>
          <li>
            必填列：<code className="text-primary">project_no</code>（项目编号）
          </li>
          <li>
            可选列：project_name、customer_name、department_id、fiscal_year、project_status、
            project_stage（<code className="text-primary">实施阶段</code> /{' '}
            <code className="text-primary">销售阶段</code>，或 implementation / sales）、start_date、end_date、
            contract_no、business_type、industry_category、product_block、project_introduction
          </li>
          <li>
            可用 <code className="text-primary">department_name</code>（部门名称）代替 department_id，
            系统会按名称解析部门。
          </li>
          <li>
            项目状态支持英文（active、preparing 等）或中文（进行中、筹备等）。同一项目编号已存在则更新。
          </li>
          <li>表头支持中文别名，例如：项目编号、项目名称、客户名称、部门名称、财年。</li>
        </ul>
        <p className="mt-3 text-xs text-default-500">
          示例：project_no,project_name,customer_name,department_id,fiscal_year,project_status
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
        <Button as={Link} href="/admin/projects" variant="flat">
          返回项目列表
        </Button>
      </div>
    </div>
  )
}
