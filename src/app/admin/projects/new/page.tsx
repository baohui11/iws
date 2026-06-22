import { getDepartmentTree } from '@/lib/db/admin/departments'
import { listUsersForLeaderPick } from '@/lib/db/admin/user'
import ProjectForm from '@/components/admin/projects/project-form'

export default async function NewProjectPage() {
  const [departments, users] = await Promise.all([
    getDepartmentTree(),
    listUsersForLeaderPick(),
  ])

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">新建项目</h1>
        <p className="mt-1 text-sm text-foreground/50">填写项目信息，并可选添加成员与成果清单</p>
      </div>
      <div className="rounded-large border border-divider bg-content1 p-6 shadow-small">
        <ProjectForm mode="create" departments={departments} users={users} />
      </div>
    </div>
  )
}
