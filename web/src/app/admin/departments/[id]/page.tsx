import { notFound } from 'next/navigation'
import {
  getDepartmentById,
  getRootDepartments,
} from '@/modules/org/departments/repo'
import DepartmentForm from '@/modules/org/components/departments/department-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditDepartmentPage({ params }: PageProps) {
  const { id } = await params
  const [dept, roots] = await Promise.all([
    getDepartmentById(id),
    getRootDepartments(),
  ])

  if (!dept) notFound()

  const parentRoots = roots.filter((r) => r.id !== dept.id)

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">编辑部门</h1>
        <p className="text-foreground/50 mt-1 text-sm">
          部门 LD 由用户管理：将用户归属本部门且系统角色设为「部门 LD」即可
        </p>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <DepartmentForm key={dept.id} mode="edit" roots={parentRoots} initial={dept} />
      </div>
    </div>
  )
}
