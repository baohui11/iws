import { notFound } from 'next/navigation'

import PageShell from '@/components/common/page-shell'
import SubpageHeader from '@/components/common/subpage-header'
import WeeklyExemptionsForm from '@/modules/weekly/components/exemptions/weekly-exemptions-form'
import { requireUser } from '@/core/auth'
import {
  getPmProjectsForExemptions,
  listPmProjectWeekExemptions,
} from '@/modules/weekly/exemptions/repo'
import {
  getWeekOptionsUpToCurrent,
  isPmOnAnyProject,
} from '@/modules/weekly/reports/repo'

export default async function WeeklyReportExemptionsPage() {
  const user = await requireUser()
  const allowed = await isPmOnAnyProject(user.id)
  if (!allowed) {
    notFound()
  }

  const [projects, rows, weekOptions] = await Promise.all([
    getPmProjectsForExemptions(user.id),
    listPmProjectWeekExemptions(user.id),
    getWeekOptionsUpToCurrent(104),
  ])

  return (
    <PageShell width="md">
      <SubpageHeader showBack title="无工作周管理" />

      <WeeklyExemptionsForm
        projects={projects}
        initialRows={rows}
        weekOptions={weekOptions}
      />
    </PageShell>
  )
}
