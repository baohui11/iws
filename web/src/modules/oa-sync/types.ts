export interface OaDepartmentRow {
  department_no: string | null
  department_name: string | null
  parent_no: string | null
  is_deleted: string | null
  deleted_date: string | null
  flevel: string | null
}

export type OaSyncScope = 'departments' | 'users' | 'projects' | 'project_roles'
export type OaSyncTrigger = 'manual' | 'cron' | 'worker'
export type OaSyncStatus = 'running' | 'succeeded' | 'failed'

export interface OaDepartmentItem {
  code: string
  name: string
  parentCode: string | null
  level: number | null
  deletedAt: Date | null
}

export interface OaUserRow {
  email: string | null
  employee_name: string | null
  employee_no: string | null
  gender: string | null
  position: string | null
  dept_no: string | null
  is_dept_leader: boolean | null
  leave_date: string | null
}

export interface OaUserItem {
  email: string | null
  name: string
  employeeNo: string
  gender: string | null
  position: string | null
  departmentCode: string | null
  isDeptLeader: boolean
  deletedAt: Date | null
}

export interface OaProjectRow {
  project_no: string | null
  project_name: string | null
  project_stage: string | null
  project_status: string | null
  department_no: string | null
  start_date: string | null
  end_date: string | null
  project_type: string | null
  contract_no: string | null
  fiscal_year: string | null
}

export interface OaProjectItem {
  projectNo: string
  projectName: string | null
  projectStage: '实施阶段' | '销售阶段' | null
  projectStatus: '进行中' | '预结项' | '已结项' | '终止' | '已关闭' | null
  departmentCode: string | null
  startDate: string | null
  endDate: string | null
  projectType: string | null
  contractNo: string | null
  fiscalYear: string | null
}

export interface OaProjectRoleRow {
  project_no: string | null
  employee_no: string | null
  project_role: string | null
  project_statge: string | null
}

export interface OaProjectRoleItem {
  projectNo: string
  employeeNo: string
  projectRole: string
  projectStage: '实施阶段' | '销售阶段'
}

export interface OaSyncStats {
  pulledCount: number
  createdCount: number
  updatedCount: number
  parentUpdatedCount: number
  unchangedCount: number
  deletedCount: number
  missingParents: Array<{
    code: string
    parentCode: string
  }>
}

export interface OaUserSyncStats {
  pulledCount: number
  createdCount: number
  updatedCount: number
  unchangedCount: number
  deletedCount: number
  missingDepartments: Array<{
    employeeNo: string
    departmentCode: string
  }>
}

export interface OaProjectSyncStats {
  pulledCount: number
  createdCount: number
  updatedCount: number
  unchangedCount: number
  deletedCount: number
  missingDepartments: Array<{
    projectNo: string
    departmentCode: string
  }>
}

export interface OaProjectRoleSyncStats {
  pulledCount: number
  createdCount: number
  updatedCount: number
  unchangedCount: number
  deletedCount: number
  missingProjects: Array<{
    projectNo: string
    employeeNo: string
    projectStage: '实施阶段' | '销售阶段'
  }>
  missingUsers: Array<{
    projectNo: string
    employeeNo: string
    projectStage: '实施阶段' | '销售阶段'
  }>
}

export type OaLoggedSyncResult =
  | ({ runId: string; scope: 'departments' } & OaSyncStats)
  | ({ runId: string; scope: 'users' } & OaUserSyncStats)
  | ({ runId: string; scope: 'projects' } & OaProjectSyncStats)
  | ({ runId: string; scope: 'project_roles' } & OaProjectRoleSyncStats)
