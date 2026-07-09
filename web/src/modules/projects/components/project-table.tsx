'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { showErrorToast, showResultError } from '@/core/client/errors'
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Button,
  Chip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import Link from 'next/link'
import { exportProjectsCsv, listProjects } from '@/modules/projects/actions'
import type { ProjectListItem } from '@/modules/projects/types'
import type { DepartmentNode } from '@/modules/org/departments/repo'
import {
  flattenDepartmentTree,
  formatDepartmentPathLabel,
} from '@/modules/org/departments/display'
import {
  PROJECT_STATUS_LABEL,
  type ProjectStatusValue,
} from '@/constants/project-status'
import {
  PROJECT_STAGE_LABEL,
  type ProjectStageValue,
} from '@/constants/project-stage'
import ProjectListFilters from '@/modules/projects/components/project-list-filters'
import {
  AdminTablePagination,
  AdminTableSummary,
} from '@/components/common/admin-table-controls'

const STATUS_COLOR: Record<
  string,
  'success' | 'warning' | 'primary' | 'default' | 'danger'
> = {
  进行中: 'success',
  预结项: 'warning',
  已结项: 'primary',
  终止: 'danger',
  已关闭: 'default',
}

const STAGE_COLOR: Record<string, 'primary' | 'warning' | 'default'> = {
  实施阶段: 'primary',
  销售阶段: 'warning',
}

interface ProjectTableProps {
  initialProjects: ProjectListItem[]
  initialTotal: number
  departments: DepartmentNode[]
}

export default function ProjectTable({
  initialProjects,
  initialTotal,
  departments,
}: ProjectTableProps) {
  const [rows, setRows] = useState(initialProjects)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [projectStage, setProjectStage] = useState('')
  const [projectStatus, setProjectStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const listRequestSeqRef = useRef(0)

  const flatDepartments = useMemo(
    () => flattenDepartmentTree(departments),
    [departments]
  )

  const fetchPage = useCallback(
    async (
      p: number,
      kw: string,
      dept: string,
      stage: string,
      status: string
    ) => {
      const seq = ++listRequestSeqRef.current
      setIsLoading(true)
      try {
        const result = await listProjects({
          page: p,
          pageSize,
          keyword: kw.trim() || undefined,
          department_id: dept.trim() || undefined,
          project_stage: stage.trim() ? (stage as ProjectStageValue) : undefined,
          project_status: status.trim() ? (status as ProjectStatusValue) : undefined,
        })
        if (seq !== listRequestSeqRef.current) return
        if (result.success && result.data) {
          setRows(result.data.projects)
          setTotal(result.data.total)
        } else {
          showResultError(result, '加载失败')
        }
      } catch (error) {
        if (seq === listRequestSeqRef.current) {
          showErrorToast({ title: '加载失败', error })
        }
      } finally {
        if (seq === listRequestSeqRef.current) {
          setIsLoading(false)
        }
      }
    },
    [pageSize]
  )

  const skipFirst = useRef(true)
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false
      return
    }
    void fetchPage(page, keyword, departmentId, projectStage, projectStatus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, fetchPage, departmentId, projectStage, projectStatus])

  const skipFirstKeyword = useRef(true)
  useEffect(() => {
    if (skipFirstKeyword.current) {
      skipFirstKeyword.current = false
      return
    }
    const timer = window.setTimeout(() => {
      if (page !== 1) {
        setPage(1)
        return
      }
      void fetchPage(1, keyword, departmentId, projectStage, projectStatus)
    }, 300)
    return () => window.clearTimeout(timer)
    // 只让关键词输入触发防抖刷新；下拉筛选仍走上面的筛选 effect。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword])

  const handleSearch = () => {
    setPage(1)
    void fetchPage(1, keyword, departmentId, projectStage, projectStatus)
  }

  const downloadCsv = async () => {
    setIsExporting(true)
    try {
      const result = await exportProjectsCsv({
        keyword: keyword.trim() || undefined,
        department_id: departmentId.trim() || undefined,
        project_stage: projectStage.trim() ? (projectStage as ProjectStageValue) : undefined,
        project_status: projectStatus.trim() ? (projectStatus as ProjectStatusValue) : undefined,
      })
      if (!result.success) {
        showResultError(result, '导出失败')
        return
      }
      const blob = new Blob([result.data.csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.data.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      showErrorToast({ title: '导出失败', error })
    } finally {
      setIsExporting(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ProjectListFilters
          departments={departments}
          departmentId={departmentId}
          keyword={keyword}
          projectStage={projectStage}
          projectStatus={projectStatus}
          isDisabled={isLoading}
          onKeywordChange={setKeyword}
          onKeywordSubmit={handleSearch}
          onDepartmentChange={(id) => {
            setDepartmentId(id)
            setPage(1)
          }}
          onProjectStageChange={(stage) => {
            setProjectStage(stage)
            setPage(1)
          }}
          onProjectStatusChange={(status) => {
            setProjectStatus(status)
            setPage(1)
          }}
          className="flex-1"
        />
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="flat"
            color="primary"
            isLoading={isExporting}
            startContent={
              !isExporting && <Icon icon="lucide:download" className="size-4" aria-hidden />
            }
            onPress={() => void downloadCsv()}
          >
            导出 CSV
          </Button>
          <Dropdown>
            <DropdownTrigger>
              <Button
                color="secondary"
                variant="flat"
                size="sm"
                startContent={<Icon icon="lucide:file-up" className="size-4" aria-hidden />}
              >
                批量导入
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="批量导入">
              <DropdownItem
                key="deliverables"
                as={Link}
                href="/admin/projects/import/deliverables"
              >
                成果清单
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>

      <Table
        aria-label="项目列表"
        classNames={{ wrapper: 'overflow-x-auto' }}
        bottomContent={
          <AdminTablePagination page={page} totalPages={totalPages} onChange={setPage} />
        }
      >
        <TableHeader>
          <TableColumn>项目编号</TableColumn>
          <TableColumn>项目名称</TableColumn>
          <TableColumn>部门</TableColumn>
          <TableColumn>项目阶段</TableColumn>
          <TableColumn>状态</TableColumn>
          <TableColumn align="end">操作</TableColumn>
        </TableHeader>
        <TableBody emptyContent={isLoading ? '加载中…' : '暂无数据'}>
          {rows.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <span className="font-mono text-sm">{p.project_no ?? '—'}</span>
              </TableCell>
              <TableCell>{p.project_name ?? '—'}</TableCell>
              <TableCell>
                {formatDepartmentPathLabel(
                  p.department_id,
                  flatDepartments,
                  p.department_name
                )}
              </TableCell>
              <TableCell>
                {p.project_stage ? (
                  <Chip
                    size="sm"
                    variant="flat"
                    color={STAGE_COLOR[p.project_stage] ?? 'default'}
                  >
                    {PROJECT_STAGE_LABEL[p.project_stage as ProjectStageValue] ??
                      p.project_stage}
                  </Chip>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell>
                {p.project_status ? (
                  <Chip
                    size="sm"
                    variant="flat"
                    color={STATUS_COLOR[p.project_status] ?? 'default'}
                  >
                    {PROJECT_STATUS_LABEL[p.project_status as ProjectStatusValue] ??
                      p.project_status}
                  </Chip>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    as={Link}
                    href={`/admin/projects/${p.id}`}
                    size="sm"
                    variant="light"
                    isIconOnly
                  >
                    <Icon
                      icon="lucide:eye"
                      className="text-default-600 size-[18px]"
                      aria-hidden
                    />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AdminTableSummary total={total} page={page} totalPages={totalPages} />
    </div>
  )
}
