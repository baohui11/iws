import Link from 'next/link'
import ImportProjectsForm from '@/components/admin/projects/import-projects-form'

export default function ImportProjectsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">导入项目</h1>
        <p className="mt-1 text-sm text-foreground/50">按项目编号批量导入或更新（不含成员与成果清单）</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/admin/projects/import/members" className="text-primary">
            导入项目成员
          </Link>
          <Link href="/admin/projects/import/deliverables" className="text-primary">
            导入成果清单
          </Link>
        </p>
      </div>
      <div className="rounded-large border border-divider bg-content1 p-6 shadow-small">
        <ImportProjectsForm />
      </div>
    </div>
  )
}
