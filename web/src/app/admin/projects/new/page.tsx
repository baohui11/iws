import { getDepartmentTree } from '@/modules/org/departments/repo'
import { listUsersForLeaderPick } from '@/modules/org/users/repo'
import ProjectForm from '@/modules/projects/components/project-form'

export default async function NewProjectPage() {
  const [departments, users] = await Promise.all([
    getDepartmentTree(),
    listUsersForLeaderPick(),
  ])

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">新建项目</h1>
      </div>
      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <ProjectForm mode="create" departments={departments} users={users} />
      </div>
    </div>
  )
}
