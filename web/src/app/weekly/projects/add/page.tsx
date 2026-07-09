import SubpageHeader from '@/components/common/subpage-header'
import { requireUser } from '@/core/auth'
import AddMyProjectPanel from '@/modules/weekly/components/projects/add-my-project-panel'

export default async function WeeklyAddProjectPage() {
  await requireUser()

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <SubpageHeader showBack title="添加项目" />

      <div className="rounded-2xl border border-default-200/80 bg-content1 p-5 shadow-sm md:p-6">
        <AddMyProjectPanel redirectHref="/weekly/projects" />
      </div>
    </div>
  )
}
