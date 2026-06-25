import { WeeklySidebar } from '@/modules/weekly/components/navigation/weekly-sidebar'

export default function WeeklyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col md:flex-row md:items-stretch">
      <WeeklySidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
