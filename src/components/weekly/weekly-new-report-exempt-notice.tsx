import SubpageHeader from '@/components/common/subpage-header'

interface WeeklyNewReportExemptNoticeProps {
  projectName: string | null
  weekLabel: string
}

/** 项目经理已为该项目该周设置无工作周时，新建页底部提示且不提供填报表单 */
export default function WeeklyNewReportExemptNotice({
  projectName,
  weekLabel,
}: WeeklyNewReportExemptNoticeProps) {
  const scope = [projectName, weekLabel].filter(Boolean).join(' · ')

  return (
    <div className="container mx-auto flex min-h-[min(70vh,720px)] max-w-3xl flex-col px-4 py-6 sm:py-8">
      <SubpageHeader
        showBack
        title="新建周报"
        description={scope || '—'}
      />
      <div className="mt-6 flex flex-1 flex-col">
        <div className="flex-1 rounded-xl border border-dashed border-default-200 bg-content1/40 p-8 text-center text-sm text-default-500">
          请选择其他周次或项目后再填写周报。
        </div>
        <p className="mt-auto border-t border-default-100 pt-6 text-center text-sm text-warning-600">
          项目经理已经设置本周无工作周
        </p>
      </div>
    </div>
  )
}
