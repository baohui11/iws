import { getRootDepartments } from '@/modules/org/departments/repo'
import DepartmentForm from '@/modules/org/components/departments/department-form'

export default async function NewDepartmentPage() {
  const roots = await getRootDepartments()

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">添加部门</h1>
        <p className="text-foreground/50 mt-1 text-sm">
          子部门请选择根部门作为上级；部门 LD 请在用户管理中设置归属部门与「部门 LD」角色
        </p>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <DepartmentForm mode="create" roots={roots} />
      </div>
    </div>
  )
}
