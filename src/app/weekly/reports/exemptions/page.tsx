import { notFound } from 'next/navigation'

import WeeklyExemptionsForm from '@/components/weekly/weekly-exemptions-form'
import SubpageHeader from '@/components/common/subpage-header'
import { getSessionProfile } from '@/lib/db/auth/profile'
import {
  getPmProjectsForExemptions,
  listPmProjectWeekExemptions,
} from '@/lib/db/weekly/exemptions'
import { getWeekOptionsUpToCurrent, isPmOnAnyProject } from '@/lib/db/weekly/reports'

export default async function WeeklyReportExemptionsPage() {
  const profile = await getSessionProfile()
  const allowed = await isPmOnAnyProject(profile.id)
  if (!allowed) {
    notFound()
  }

  const [projects, rows, weekOptions] = await Promise.all([
    getPmProjectsForExemptions(profile.id),
    listPmProjectWeekExemptions(profile.id),
    getWeekOptionsUpToCurrent(104),
  ])

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <SubpageHeader showBack title="无工作周管理" />

      <WeeklyExemptionsForm
        projects={projects}
        initialRows={rows}
        weekOptions={weekOptions}
      />
    </div>
  )
}
