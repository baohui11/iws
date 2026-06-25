import ImportProjectMembersForm from '@/modules/projects/components/import-project-members-form'

export default function ImportProjectMembersPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">批量导入项目成员</h1>
        <p className="text-foreground/50 mt-1 text-sm">
          按项目编号 + 工号导入成员与角色
        </p>
      </div>
      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <ImportProjectMembersForm />
      </div>
    </div>
  )
}
