import { notFound } from 'next/navigation'
import { getProjectById } from '@/modules/projects/repo'
import { getDepartmentTree } from '@/modules/org/departments/repo'
import { listUsersForLeaderPick } from '@/modules/org/users/repo'
import ProjectForm from '@/modules/projects/components/project-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditProjectPage({ params }: PageProps) {
  const { id } = await params
  const [project, departments, users] = await Promise.all([
    getProjectById(id),
    getDepartmentTree(),
    listUsersForLeaderPick(),
  ])

  if (!project) notFound()

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">编辑项目</h1>
      </div>
      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <ProjectForm
          key={project.id}
          mode="edit"
          project={project}
          departments={departments}
          users={users}
        />
      </div>
    </div>
  )
}
