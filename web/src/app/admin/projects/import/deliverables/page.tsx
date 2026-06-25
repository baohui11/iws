import ImportProjectDeliverablesForm from '@/modules/projects/components/import-project-deliverables-form'

export default function ImportProjectDeliverablesPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">批量导入成果清单</h1>
        <p className="text-foreground/50 mt-1 text-sm">按项目编号导入合同成果项</p>
      </div>
      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <ImportProjectDeliverablesForm />
      </div>
    </div>
  )
}
