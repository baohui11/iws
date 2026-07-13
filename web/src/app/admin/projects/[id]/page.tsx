import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import PageShell from '@/components/common/page-shell'
import { getProject } from '@/modules/projects/service'
import ProjectStatusChip from '@/modules/projects/components/project-status-chip'
import ProjectDeliverablesEditor from '@/modules/projects/components/project-deliverables-editor'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditProjectPage({ params }: PageProps) {
  const { id } = await params
  const project = await getProject(id).catch(() => null)

  if (!project) notFound()

  return (
    <PageShell width="lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">项目详情</h1>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small space-y-8 border p-6">
        <section>
          <h2 className="mb-4 text-lg font-semibold">基本信息</h2>
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Info label="项目编号">{project.project_no ?? '-'}</Info>
            <Info label="项目名称">{project.project_name ?? '-'}</Info>
            <Info label="所属部门">{project.department_name ?? '-'}</Info>
            <Info label="项目阶段">{project.project_stage ?? '-'}</Info>
            <Info label="项目状态">
              {project.project_status ? (
                <ProjectStatusChip value={project.project_status} />
              ) : (
                '-'
              )}
            </Info>
            <Info label="IWS 生效">{project.is_active ? '已生效' : '未生效'}</Info>
            <Info label="项目类型">{project.project_type ?? '-'}</Info>
            <Info label="财年">{project.fiscal_year ?? '-'}</Info>
            <Info label="开始日期">{project.start_date ?? '-'}</Info>
            <Info label="结束日期">{project.end_date ?? '-'}</Info>
            <Info label="合同编号">{project.contract_no ?? '-'}</Info>
          </dl>
        </section>

        <section>
          <ProjectDeliverablesEditor
            projectId={project.id}
            initialRows={project.deliverables}
          />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">项目成员</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-default-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">姓名</th>
                  <th className="py-2 pr-4 font-medium">邮箱</th>
                  <th className="py-2 pr-4 font-medium">角色</th>
                  <th className="py-2 pr-4 font-medium">阶段</th>
                  <th className="py-2 pr-4 font-medium">成员生效</th>
                </tr>
              </thead>
              <tbody>
                {project.members.length > 0 ? (
                  project.members.map((member) => (
                    <tr key={member.id} className="border-divider border-t">
                      <td className="py-3 pr-4">{member.user_name ?? '-'}</td>
                      <td className="py-3 pr-4">{member.user_email ?? '-'}</td>
                      <td className="py-3 pr-4">{member.project_role ?? '-'}</td>
                      <td className="py-3 pr-4">{member.project_stage ?? '-'}</td>
                      <td className="py-3 pr-4">
                        {member.is_active ? '已生效' : '未生效'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="text-default-500 py-6" colSpan={5}>
                      暂无成员
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageShell>
  )
}

function Info({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <dt className="text-default-500 text-xs">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  )
}
