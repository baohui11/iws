import type { ProjectStatusValue } from '@/constants/project-status'
export interface ProjectRow {
  id: string
  contract_no: string | null
  created_at: string
  deleted_at: string | null
  department_id: string | null
  end_date: string | null
  fiscal_year: string | null
  project_name: string | null
  project_no: string | null
  project_stage: string | null
  project_status: ProjectStatusValue | null
  project_type: string | null
  start_date: string | null
  is_active: boolean
}

export type InsertProjectData = {
  contract_no?: string | null
  department_id?: string | null
  end_date?: string | null
  fiscal_year?: string | null
  project_name?: string | null
  project_no?: string
  project_stage?: string | null
  project_status?: ProjectStatusValue | null
  project_type?: string | null
  start_date?: string | null
  is_active?: boolean
}

export type UpdateProjectData = Partial<InsertProjectData>

export interface ProjectListItem {
  id: string
  project_no: string | null
  project_name: string | null
  fiscal_year: string | null
  project_status: ProjectStatusValue | null
  project_stage: string | null
  project_type: string | null
  start_date: string | null
  end_date: string | null
  contract_no: string | null
  department_id: string | null
  department_name: string | null
  is_active: boolean
}

/** 周报「我的项目」列表行 */
export interface WeeklyProjectListItem extends ProjectListItem {
  is_participating: boolean
  my_project_role: string | null
}

export interface ProjectMemberRow {
  id: string
  user_id: string | null
  project_role: string | null
  project_stage: string | null
  is_active: boolean
  user_name: string | null
  user_email: string | null
}

export interface DeliverableRow {
  id: string
  name: string
  description: string | null
}

export interface ProjectDetail extends ProjectRow {
  department_name: string | null
  members: ProjectMemberRow[]
  deliverables: DeliverableRow[]
}
