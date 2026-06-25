import { getDepartmentList } from '@/modules/org/departments/repo'
import DepartmentTable from '@/modules/org/components/departments/department-table'

export default async function AdminDepartmentsPage() {
  const { departments, total } = await getDepartmentList({ page: 1, pageSize: 20 })

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">部门管理</h1>
          <p className="text-foreground/50 mt-1 text-sm">
            维护两级部门、部门 LD；指定 LD 后用户角色将同步为「部门 LD」
          </p>
        </div>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <DepartmentTable initialDepartments={departments} initialTotal={total} />
      </div>
    </div>
  )
}
