import { Suspense } from "react";

import SubpageHeader from "@/components/common/subpage-header";
import WeeklyProjectsList from "@/components/weekly/weekly-projects-list";
import { WEEKLY_PROJECTS_PAGE_SIZE } from "@/constants/weekly-projects-space";
import { getSessionProfile } from "@/lib/db/auth/profile";
import { getDepartmentTree } from "@/lib/db/admin/departments";
import { getMyWeeklyProjectsList } from "@/lib/db/weekly/projects";
import { parseWeeklyProjectsSearchParamsFromRecord } from "@/lib/utils/weekly-projects-url";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WeeklyProjectsPage({ searchParams }: PageProps) {
  const profile = await getSessionProfile();

  const sp = await searchParams;
  const urlState = parseWeeklyProjectsSearchParamsFromRecord(sp);

  const [departments, listResult] = await Promise.all([
    getDepartmentTree(),
    getMyWeeklyProjectsList({
      userId: profile.id,
      role: profile.role,
      userDepartmentId: profile.department_id,
      offset: 0,
      pageSize: WEEKLY_PROJECTS_PAGE_SIZE,
      keyword: urlState.q.trim() || undefined,
      departmentFilterId: urlState.dept.trim() || undefined,
      projectStatusFilter: urlState.status.trim() || undefined,
      onlyParticipating: urlState.mine,
    }),
  ]);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <SubpageHeader title="我的项目" />

      <div className="rounded-2xl border border-default-200/80 bg-content1 p-5 shadow-sm md:p-6">
        <Suspense fallback={<p className="text-sm text-default-500">加载中…</p>}>
          <WeeklyProjectsList
            initialProjects={listResult.projects}
            initialTotal={listResult.total}
            departments={departments}
            initialListState={urlState}
          />
        </Suspense>
      </div>
    </div>
  );
}
