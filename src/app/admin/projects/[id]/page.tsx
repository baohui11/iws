import { notFound } from 'next/navigation'
import { getProjectById } from '@/lib/db/admin/projects'
import { getDepartmentTree } from '@/lib/db/admin/departments'
import { listUsersForLeaderPick } from '@/lib/db/admin/user'
import ProjectForm from '@/components/admin/projects/project-form'

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
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">编辑项目</h1>
        <p className="mt-1 text-sm text-foreground/50">
          {project.project_name ?? project.project_no ?? project.id}
        </p>
      </div>
      <div className="rounded-large border border-divider bg-content1 p-6 shadow-small">
        <ProjectForm mode="edit" project={project} departments={departments} users={users} />
      </div>
    </div>
  )
}
