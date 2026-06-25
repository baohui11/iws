'use client'

import { useState, useRef } from 'react'
import { Button, addToast } from '@heroui/react'
import { Icon, addCollection } from '@iconify/react'
import solarIcons from '@iconify-json/solar/icons.json'
import Link from 'next/link'
import { importProjectMembers } from '@/modules/projects/actions'
import { parseProjectMembersCsv } from '@/modules/projects/csv'

addCollection(solarIcons as Parameters<typeof addCollection>[0])

export default function ImportProjectMembersForm() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, setIsPending] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewCount, setPreviewCount] = useState<number | null>(null)

  const handleFile = async (file: File | null) => {
    if (!file) return
    setFileName(file.name)
    setPreviewCount(parseProjectMembersCsv(await file.text()).length)
  }

  const handleSubmit = async () => {
    const file = inputRef.current?.files?.[0]
    if (!file) {
      addToast({ title: '请选择文件', color: 'warning' })
      return
    }
    const rows = parseProjectMembersCsv(await file.text())
    if (rows.length === 0) {
      addToast({ title: '无有效数据', color: 'warning' })
      return
    }
    setIsPending(true)
    const result = await importProjectMembers(rows)
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
          .map((r) => `${r.project_no}/${r.employee_no}: ${r.message}`)
          .join('；')
        addToast({ title: '部分失败', description: detail, color: 'danger', timeout: 8000 })
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
          <li>必填列：<code className="text-primary">project_no</code>（项目编号）、<code className="text-primary">employee_no</code>（用户工号）、<code className="text-primary">project_role</code>（项目角色）。</li>
          <li>角色：pm/member/director/sale_ld，或中文：项目经理/项目成员/项目总监/销售LD（须与项目阶段匹配）。</li>
          <li>表头支持中文：项目编号、工号、项目角色。</li>
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0] ?? null)} />
        <Button variant="bordered" startContent={<Icon icon="solar:folder-with-files-linear" />} onPress={() => inputRef.current?.click()}>
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
        <Button color="primary" isLoading={isPending} isDisabled={!fileName} onPress={() => void handleSubmit()}>
          开始导入
        </Button>
        <Button as={Link} href="/admin/projects" variant="flat">
          返回项目列表
        </Button>
      </div>
    </div>
  )
}
