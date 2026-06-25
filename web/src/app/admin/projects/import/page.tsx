import ImportProjectsForm from '@/modules/projects/components/import-projects-form'

export default function ImportProjectsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">批量导入项目</h1>
        <p className="text-foreground/50 mt-1 text-sm">上传 UTF-8 CSV，按项目编号 upsert</p>
      </div>
      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <ImportProjectsForm />
      </div>
    </div>
  )
}
