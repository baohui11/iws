import ImportUsersForm from '@/components/admin/users/import-users-form'

export default function AdminUsersImportPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">批量导入用户</h1>
        <p className="mt-1 text-sm text-foreground/50">
          上传 UTF-8 编码的 CSV，系统将向邮箱发送邀请并完成用户创建
        </p>
      </div>

      <div className="rounded-large border border-divider bg-content1 p-6 shadow-small">
        <ImportUsersForm />
      </div>
    </div>
  )
}
