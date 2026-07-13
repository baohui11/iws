import { Suspense } from 'react'

import PageShell from '@/components/common/page-shell'
import SubpageHeader from '@/components/common/subpage-header'
import WeeklyProjectsList from '@/modules/weekly/components/projects/weekly-projects-list'
import { WEEKLY_PROJECTS_PAGE_SIZE } from '@/constants/weekly-projects-space'
import { requireUser } from '@/core/auth'
import {
  getAdminDepartmentScopeIds,
  getDepartmentTree,
} from '@/modules/org/departments/repo'
import { getMyWeeklyProjectsList } from '@/modules/weekly/projects/repo'
import { parseWeeklyProjectsSearchParamsFromRecord } from '@/modules/weekly/lib/weekly-projects-url'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function WeeklyProjectsPage({ searchParams }: PageProps) {
  const user = await requireUser()

  const sp = await searchParams
  const urlState = parseWeeklyProjectsSearchParamsFromRecord(sp)
  const canSwitchScope = user.role != null && user.role !== 'user'
  const listState = canSwitchScope ? urlState : { ...urlState, mine: true }
  const allowedDepartmentIds = canSwitchScope
    ? await getAdminDepartmentScopeIds(user)
    : null

  const [departments, listResult] = await Promise.all([
    getDepartmentTree({ allowedDepartmentIds }),
    getMyWeeklyProjectsList({
      userId: user.id,
      role: user.role,
      userDepartmentId: user.departmentId,
      offset: 0,
      pageSize: WEEKLY_PROJECTS_PAGE_SIZE,
      keyword: listState.q.trim() || undefined,
      departmentFilterId: listState.dept.trim() || undefined,
      projectStageFilter: listState.stage.trim() || undefined,
      projectStatusFilter: listState.status.trim() || undefined,
      onlyParticipating: listState.mine,
    }),
  ])

  return (
    <PageShell>
      <SubpageHeader title="我的项目" />

      <div className="rounded-2xl border border-default-200/80 bg-content1 p-5 shadow-sm md:p-6">
        <Suspense fallback={<p className="text-sm text-default-500">加载中…</p>}>
          <WeeklyProjectsList
            initialProjects={listResult.projects}
            initialTotal={listResult.total}
            departments={departments}
            initialListState={listState}
            canSwitchScope={canSwitchScope}
          />
        </Suspense>
      </div>
    </PageShell>
  )
}
