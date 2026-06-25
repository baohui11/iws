import { getCurrentUser } from '@/core/auth'

export default async function HomePage() {
  const user = await getCurrentUser()

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold">
        欢迎，{user?.name || user?.email || '访客'}
      </h1>
      <p className="text-default-500 mt-2 text-sm">
        中大咨询集团周报文件系统。请从顶部导航进入「项目周报」「搜索文件」等功能。
      </p>
    </div>
  )
}
