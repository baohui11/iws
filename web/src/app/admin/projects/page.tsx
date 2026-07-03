import {
  getAdminDepartmentScopeIds,
  getDepartmentTree,
} from '@/modules/org/departments/repo'
import { getProjectList } from '@/modules/projects/repo'
import { requireAdmin } from '@/modules/org/guard'
import ProjectTable from '@/modules/projects/components/project-table'

export default async function AdminProjectsPage() {
  const actor = await requireAdmin()
  const allowedDepartmentIds = await getAdminDepartmentScopeIds(actor)
  const [list, departments] = await Promise.all([
    getProjectList({
      page: 1,
      pageSize: 20,
      allowed_department_ids: allowedDepartmentIds,
    }),
    getDepartmentTree({ allowedDepartmentIds }),
  ])

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">项目管理</h1>
        <p className="text-foreground/50 mt-1 text-sm">
          项目与成员来自 OA 同步，平台侧维护成果清单与后续生效状态
        </p>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <ProjectTable
          initialProjects={list.projects}
          initialTotal={list.total}
          departments={departments}
        />
      </div>
    </div>
  )
}
