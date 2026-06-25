import type { ProjectStatusValue } from '@/constants/project-status'
import type { ProjectRoleValue } from '@/constants/project-roles'

export interface ProjectRow {
  id: string
  business_type: string | null
  contract_no: string | null
  created_at: string
  customer_name: string | null
  deleted_at: string | null
  department_id: string | null
  end_date: string | null
  fiscal_year: string | null
  industry_category: string | null
  product_block: string | null
  project_introduction: string | null
  project_name: string | null
  project_no: string | null
  project_stage: string | null
  project_status: ProjectStatusValue | null
  start_date: string | null
}

export type InsertProjectData = {
  business_type?: string | null
  contract_no?: string | null
  customer_name?: string | null
  department_id?: string | null
  end_date?: string | null
  fiscal_year?: string | null
  industry_category?: string | null
  product_block?: string | null
  project_introduction?: string | null
  project_name?: string | null
  project_no?: string
  project_stage?: string | null
  project_status?: ProjectStatusValue | null
  start_date?: string | null
}

export type UpdateProjectData = Partial<InsertProjectData>

export interface ProjectListItem {
  id: string
  project_no: string | null
  project_name: string | null
  customer_name: string | null
  fiscal_year: string | null
  project_status: ProjectStatusValue | null
  project_stage: string | null
  start_date: string | null
  end_date: string | null
  contract_no: string | null
  department_id: string | null
  department_name: string | null
}

/** 周报「我的项目」列表行 */
export interface WeeklyProjectListItem extends ProjectListItem {
  is_participating: boolean
  my_project_role: ProjectRoleValue | null
}

export interface ProjectMemberRow {
  id: string
  user_id: string | null
  project_role: ProjectRoleValue | null
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
