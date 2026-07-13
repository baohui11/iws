import PageShell from '@/components/common/page-shell'
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
    <PageShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">项目管理</h1>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <ProjectTable
          initialProjects={list.projects}
          initialTotal={list.total}
          departments={departments}
        />
      </div>
    </PageShell>
  )
}
