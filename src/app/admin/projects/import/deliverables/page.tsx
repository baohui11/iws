import Link from 'next/link'
import ImportProjectDeliverablesForm from '@/components/admin/projects/import-project-deliverables-form'

export default function ImportProjectDeliverablesPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">批量导入项目成果清单</h1>
        <p className="mt-1 text-sm text-foreground/50">
          按项目编号为每个成果新增一条合同成果记录
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/admin/projects/import" className="text-primary">
            导入项目主表
          </Link>
          <Link href="/admin/projects/import/members" className="text-primary">
            导入项目成员
          </Link>
        </p>
      </div>
      <div className="rounded-large border border-divider bg-content1 p-6 shadow-small">
        <ImportProjectDeliverablesForm />
      </div>
    </div>
  )
}
