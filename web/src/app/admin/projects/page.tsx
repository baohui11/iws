import { getProjectList } from '@/modules/projects/repo'
import { getDepartmentTree } from '@/modules/org/departments/repo'
import ProjectTable from '@/modules/projects/components/project-table'

export default async function AdminProjectsPage() {
  const [list, departments] = await Promise.all([
    getProjectList({ page: 1, pageSize: 20 }),
    getDepartmentTree(),
  ])

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">项目管理</h1>
        <p className="text-foreground/50 mt-1 text-sm">
          管理项目、成员与合同成果清单，支持批量导入
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
