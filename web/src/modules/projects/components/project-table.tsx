'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { showResultError } from '@/core/client/errors'
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
  Select,
  SelectItem,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import Link from 'next/link'
import { exportProjectsCsv, listProjects } from '@/modules/projects/actions'
import type { ProjectListItem } from '@/modules/projects/types'
import type { DepartmentNode } from '@/modules/org/departments/repo'
import DepartmentTreeSelect from '@/modules/org/components/department-tree-select'
import {
  flattenDepartmentTree,
  formatDepartmentPathLabel,
} from '@/modules/org/departments/display'
import {
  PROJECT_STATUS_VALUES,
  PROJECT_STATUS_LABEL,
  type ProjectStatusValue,
} from '@/constants/project-status'
import {
  PROJECT_STAGE_LABEL,
  PROJECT_STAGE_VALUES,
  type ProjectStageValue,
} from '@/constants/project-stage'
import {
  AdminTablePagination,
  AdminTableSummary,
  AdminTableToolbar,
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
      setIsLoading(true)
      const result = await listProjects({
        page: p,
        pageSize,
        keyword: kw.trim() || undefined,
        department_id: dept.trim() || undefined,
        project_stage: stage.trim() ? (stage as ProjectStageValue) : undefined,
        project_status: status.trim() ? (status as ProjectStatusValue) : undefined,
      })
      setIsLoading(false)
      if (result.success && result.data) {
        setRows(result.data.projects)
        setTotal(result.data.total)
      } else {
        showResultError(result, '加载失败')
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

  const handleSearch = () => {
    setPage(1)
    void fetchPage(1, keyword, departmentId, projectStage, projectStatus)
  }

  const downloadCsv = async () => {
    setIsExporting(true)
    const result = await exportProjectsCsv({
      keyword: keyword.trim() || undefined,
      department_id: departmentId.trim() || undefined,
      project_stage: projectStage.trim() ? (projectStage as ProjectStageValue) : undefined,
      project_status: projectStatus.trim() ? (projectStatus as ProjectStatusValue) : undefined,
    })
    setIsExporting(false)
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
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      <AdminTableToolbar
        keyword={keyword}
        onKeywordChange={setKeyword}
        onSearch={handleSearch}
        searchPlaceholder="编号、名称、合同号"
        isLoading={isLoading}
        filters={
          <>
            <DepartmentTreeSelect
              departments={departments}
              value={departmentId}
              onChange={(id) => {
                setDepartmentId(id)
                setPage(1)
              }}
              placeholder="全部部门"
              emptyOptionLabel="全部部门"
              size="sm"
              variant="bordered"
              className="w-[260px]"
            />
            <Select
              aria-label="项目阶段筛选"
              placeholder="全部阶段"
              selectedKeys={projectStage ? new Set([projectStage]) : new Set(['__all__'])}
              onSelectionChange={(keys) => {
                if (keys === 'all') return
                const next = String(Array.from(keys)[0] ?? '')
                setProjectStage(next === '__all__' ? '' : next)
                setPage(1)
              }}
              size="sm"
              variant="bordered"
              className="w-[140px]"
            >
              {[
                { key: '__all__', label: '全部阶段' },
                ...PROJECT_STAGE_VALUES.map((value) => ({
                  key: value,
                  label: PROJECT_STAGE_LABEL[value],
                })),
              ].map((option) => (
                <SelectItem key={option.key}>{option.label}</SelectItem>
              ))}
            </Select>
            <Select
              aria-label="项目状态筛选"
              placeholder="全部状态"
              selectedKeys={projectStatus ? new Set([projectStatus]) : new Set(['__all__'])}
              onSelectionChange={(keys) => {
                if (keys === 'all') return
                const next = String(Array.from(keys)[0] ?? '')
                setProjectStatus(next === '__all__' ? '' : next)
                setPage(1)
              }}
              size="sm"
              variant="bordered"
              className="w-[140px]"
            >
              {[
                { key: '__all__', label: '全部状态' },
                ...PROJECT_STATUS_VALUES.map((value) => ({
                  key: value,
                  label: PROJECT_STATUS_LABEL[value],
                })),
              ].map((option) => (
                <SelectItem key={option.key}>{option.label}</SelectItem>
              ))}
            </Select>
          </>
        }
        actions={
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
        }
      />

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
