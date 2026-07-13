import { notFound } from 'next/navigation'
import PageShell from '@/components/common/page-shell'
import { getCurrentUser } from '@/core/auth'
import { getDepartmentList } from '@/modules/org/departments/repo'
import DepartmentTable from '@/modules/org/components/departments/department-table'

export default async function AdminDepartmentsPage() {
  const currentUser = await getCurrentUser()
  if (currentUser?.role !== 'admin') notFound()

  const { departments, total } = await getDepartmentList({ page: 1, pageSize: 20 })

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">部门管理</h1>
        </div>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <DepartmentTable initialDepartments={departments} initialTotal={total} />
      </div>
    </PageShell>
  )
}
