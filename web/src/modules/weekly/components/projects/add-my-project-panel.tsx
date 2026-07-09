'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input } from '@heroui/react'
import { Icon } from '@iconify/react'
import { showErrorToast, showResultError } from '@/core/client/errors'
import {
  activateMyWeeklyProjectAction,
  searchAddableWeeklyProjectsAction,
} from '@/modules/weekly/projects/actions'
import type { WeeklyAddableProject } from '@/modules/weekly/projects/repo'

interface AddMyProjectPanelProps {
  onAdded?: (project: WeeklyAddableProject) => void
  onClose?: () => void
  redirectHref?: string
}

export default function AddMyProjectPanel({
  onAdded,
  onClose,
  redirectHref,
}: AddMyProjectPanelProps) {
  const router = useRouter()
  const [keyword, setKeyword] = useState('')
  const [rows, setRows] = useState<WeeklyAddableProject[]>([])
  const [loading, setLoading] = useState(false)
  const [activatingProjectId, setActivatingProjectId] = useState<string | null>(null)

  const loadProjects = useCallback(async (kw: string) => {
    setLoading(true)
    try {
      const result = await searchAddableWeeklyProjectsAction({
        keyword: kw.trim() || undefined,
        limit: 30,
      })
      if (!result.success) {
        showResultError(result, '加载失败')
        return
      }
      setRows(result.data)
    } catch (error) {
      showErrorToast({ title: '加载失败', error })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProjects(keyword)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [keyword, loadProjects])

  const activateProject = async (project: WeeklyAddableProject) => {
    setActivatingProjectId(project.id)
    const result = await activateMyWeeklyProjectAction({ projectId: project.id })
    setActivatingProjectId(null)
    if (!result.success) {
      showResultError(result, '添加失败')
      return
    }
    setRows((current) => current.filter((item) => item.id !== project.id))
    onAdded?.(project)
    onClose?.()
    if (redirectHref) router.push(redirectHref)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="搜索项目编号、名称、合同号"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void loadProjects(keyword)}
          variant="bordered"
          size="sm"
          startContent={
            <Icon
              icon="lucide:search"
              className="size-4 text-default-400"
              aria-hidden
            />
          }
        />
        <Button
          color="primary"
          size="sm"
          isLoading={loading}
          onPress={() => void loadProjects(keyword)}
        >
          搜索
        </Button>
      </div>

      <div className="max-h-[520px] space-y-2 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-default-200 py-10 text-center text-sm text-default-500">
            {loading ? '加载中...' : '暂无可添加项目'}
          </p>
        ) : (
          rows.map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-default-200 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {project.project_name ?? project.project_no ?? '-'}
                </p>
                <p className="mt-1 text-xs text-default-500">
                  {project.project_no ?? '-'} · {project.project_stage ?? '-'} ·{' '}
                  {project.department_name ?? '-'} ·{' '}
                  {project.my_project_role ?? '成员'}
                </p>
              </div>
              <Button
                size="sm"
                color="primary"
                isLoading={activatingProjectId === project.id}
                onPress={() => void activateProject(project)}
              >
                添加
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
