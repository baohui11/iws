import Link from 'next/link'
import ImportProjectMembersForm from '@/components/admin/projects/import-project-members-form'

export default function ImportProjectMembersPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">批量导入项目成员</h1>
        <p className="mt-1 text-sm text-foreground/50">
          按项目编号、用户工号与角色追加或更新成员（项目与用户须已存在）
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/admin/projects/import" className="text-primary">
            导入项目主表
          </Link>
          <Link href="/admin/projects/import/deliverables" className="text-primary">
            导入成果清单
          </Link>
        </p>
      </div>
      <div className="rounded-large border border-divider bg-content1 p-6 shadow-small">
        <ImportProjectMembersForm />
      </div>
    </div>
  )
}
