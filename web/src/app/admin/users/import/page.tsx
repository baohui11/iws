import ImportUsersForm from '@/modules/org/components/users/import-users-form'

export default function AdminUsersImportPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">批量导入用户</h1>
        <p className="text-foreground/50 mt-1 text-sm">
          上传 UTF-8 编码的 CSV，批量创建用户档案
        </p>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <ImportUsersForm />
      </div>
    </div>
  )
}
