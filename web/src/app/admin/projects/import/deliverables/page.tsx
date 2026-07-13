import PageShell from '@/components/common/page-shell'
import ImportProjectDeliverablesForm from '@/modules/projects/components/import-project-deliverables-form'

export default function ImportProjectDeliverablesPage() {
  return (
    <PageShell width="sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">批量导入成果清单</h1>
      </div>
      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <ImportProjectDeliverablesForm />
      </div>
    </PageShell>
  )
}
