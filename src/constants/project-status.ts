/**
 * 与数据库 enum project_status 一致。
 * 客户端组件请从这里引用，勿从 @/types/database 导入，以免打包器解析超大类型文件。
 */
export const PROJECT_STATUS_VALUES = [
  'active',
  'preparing',
  'completed',
  'archived',
  'suspended',
] as const

export type ProjectStatusValue = (typeof PROJECT_STATUS_VALUES)[number]

export const PROJECT_STATUS_LABEL: Record<ProjectStatusValue, string> = {
  active: '进行中',
  preparing: '筹备',
  completed: '已完成',
  archived: '已归档',
  suspended: '已暂停',
}
