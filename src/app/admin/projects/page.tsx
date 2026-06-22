import { listProjects } from '@/actions/admin/projects.action'
import { getDepartmentTree } from '@/lib/db/admin/departments'
import ProjectTable from '@/components/admin/projects/project-table'

export default async function AdminProjectsPage() {
  const [projectsResult, departments] = await Promise.all([
    listProjects({ page: 1, pageSize: 20 }),
    getDepartmentTree(),
  ])

  const initialProjects = projectsResult.success ? projectsResult.data?.projects ?? [] : []
  const initialTotal = projectsResult.success ? projectsResult.data?.total ?? 0 : 0

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">项目管理</h1>
        <p className="mt-1 text-sm text-foreground/50">
          维护项目信息、成员与合同成果清单；支持 CSV 按项目编号导入或更新
        </p>
      </div>

      <div className="rounded-large border border-divider bg-content1 p-6 shadow-small">
        <ProjectTable
          initialProjects={initialProjects}
          initialTotal={initialTotal}
          departments={departments}
        />
      </div>
    </div>
  )
}
