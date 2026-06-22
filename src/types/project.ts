/**
 * 项目相关类型：列表/详情展示、projects 表行与写入（手写，避免依赖 @/types/database）。
 * 客户端请从此文件引用，勿从 lib/db/admin/projects 仅为了类型而导入。
 */
import type { ProjectStatusValue } from '@/constants/project-status'
import type { ProjectRoleValue } from '@/constants/project-roles'

/** projects 表行（与 Supabase 一致） */
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
  id?: string
  business_type?: string | null
  contract_no?: string | null
  created_at?: string
  customer_name?: string | null
  deleted_at?: string | null
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

/** 周报「我的项目」列表行：附带是否本人参与及本人在项目中的角色 */
export interface WeeklyProjectListItem extends ProjectListItem {
  is_participating: boolean
  /** 本人在该项目中的角色；非成员为 null */
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

/** projects 表行 + 部门名 + 成员 + 成果（编辑页） */
export interface ProjectDetail {
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
  department_name: string | null
  members: ProjectMemberRow[]
  deliverables: DeliverableRow[]
}
