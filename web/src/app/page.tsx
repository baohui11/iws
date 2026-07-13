import { getCurrentUser } from '@/core/auth'
import HomeSearchBox from '@/components/home-search-box'

export default async function HomePage() {
  const user = await getCurrentUser()
  const name = user?.name || user?.email || '访客'

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-24 md:px-8 md:pt-32">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-sm text-default-500">欢迎，{name}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-foreground md:text-5xl">
          搜索项目文件
        </h1>

        <HomeSearchBox />
      </div>
    </div>
  )
}
