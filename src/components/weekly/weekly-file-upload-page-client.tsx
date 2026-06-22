'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Select,
  SelectItem,
  Spinner,
  Tab,
  Tabs,
  addToast,
} from '@heroui/react'
import { loadFileUploadOptions } from '@/actions/weekly/file-upload.action'
import type {
  FileUploadOptionsPayload,
  MemberActiveProjectOption,
} from '@/types/file-upload'
import WeeklyDeliverableUploadPanel from '@/components/weekly/weekly-deliverable-upload-panel'
import WeeklyReferenceUploadPanel from '@/components/weekly/weekly-reference-upload-panel'

export interface WeeklyFileUploadPageClientProps {
  initialProjects: MemberActiveProjectOption[]
  maxFileLabel: string
  /** 从周报等入口带入，预选项目 */
  initialProjectId?: string
  /** 上传完成后可回到的页面（如周报填写） */
  returnToHref?: string
}

export default function WeeklyFileUploadPageClient({
  initialProjects,
  maxFileLabel,
  initialProjectId,
  returnToHref,
}: WeeklyFileUploadPageClientProps) {
  const [projectId, setProjectId] = useState(initialProjectId ?? '')
  const [options, setOptions] = useState<FileUploadOptionsPayload | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)

  const loadOptions = useCallback(
    async (pid: string, opts: { keepPrevious?: boolean } = {}) => {
      const { keepPrevious = false } = opts
      if (!pid) {
        setOptions(null)
        return
      }
      setOptionsLoading(true)
      if (!keepPrevious) setOptions(null)
      const result = await loadFileUploadOptions(pid)
      setOptionsLoading(false)
      if (result.success && result.data) {
        setOptions(result.data)
      } else if (!keepPrevious) {
        setOptions(null)
        addToast({
          title: '加载失败',
          description: result.message,
          color: 'danger',
        })
      } else {
        addToast({
          title: '刷新失败',
          description: result.message,
          color: 'danger',
        })
      }
    },
    []
  )

  useEffect(() => {
    void loadOptions(projectId, { keepPrevious: false })
  }, [projectId, loadOptions])

  useEffect(() => {
    if (initialProjectId) setProjectId(initialProjectId)
  }, [initialProjectId])

  const onRefreshOptions = useCallback(() => {
    if (projectId) void loadOptions(projectId, { keepPrevious: true })
  }, [projectId, loadOptions])

  const projectItems = initialProjects.map((p) => ({
    key: p.id,
    label: p.project_name?.trim() || p.project_no || p.id,
  }))

  return (
    <div className="space-y-8">
      {returnToHref ? (
        <div className="flex flex-wrap gap-2">
          <Button
            as={Link}
            href={returnToHref}
            size="sm"
            variant="flat"
            color="primary"
          >
            完成上传，返回周报
          </Button>
        </div>
      ) : null}
      <div className="space-y-2">
        <Select
          label="项目"
          placeholder="选择项目"
          variant="bordered"
          className="w-full max-w-xl"
          items={projectItems}
          selectedKeys={projectId ? new Set([projectId]) : new Set()}
          onSelectionChange={(keys) => {
            const k = [...keys][0] as string | undefined
            setProjectId(k ?? '')
          }}
          isDisabled={optionsLoading && !options}
        >
          {(item) => (
            <SelectItem key={item.key} textValue={item.label}>
              {item.label}
            </SelectItem>
          )}
        </Select>
        <p className="text-xs text-default-400">单文件最大 {maxFileLabel}</p>
      </div>

      {!projectId ? (
        <p className="text-center text-sm text-default-500">请选择项目</p>
      ) : optionsLoading && !options ? (
        <div className="flex justify-center py-16">
          <Spinner label="加载中…" />
        </div>
      ) : !options ? (
        <p className="text-center text-sm text-danger">项目选项加载失败，请重试或切换项目</p>
      ) : (
        <Tabs aria-label="上传类型" color="primary" variant="underlined" classNames={{ panel: 'pt-4' }}>
          <Tab key="d" title="成果文件">
            <WeeklyDeliverableUploadPanel
              projectId={projectId}
              deliverables={options.deliverables}
              existingDeliverableFiles={options.existingDeliverableFiles}
              referenceFiles={options.referenceFiles}
              optionsLoading={optionsLoading}
              onRefreshOptions={onRefreshOptions}
            />
          </Tab>
          <Tab key="r" title="参考资料">
            <WeeklyReferenceUploadPanel
              projectId={projectId}
              optionsLoading={optionsLoading}
              onRefreshOptions={onRefreshOptions}
            />
          </Tab>
        </Tabs>
      )}
    </div>
  )
}
