我的项目有以下规范：

【分层规范】
- lib/db：只写 supabase 查询，错误用 handleDbError 处理
- actions：用 handleAction 包裹，用 verify 函数验证权限
- hooks：用 useMutation/useQuery，成功后 invalidateQueries

【错误处理】
- 错误类在 lib/errors.ts：AuthError/ValidationError/NotFoundError/BusinessError
- db 层：if (error) handleDbError(error)
- action 层：handleAction 包裹，业务错误抛对应错误类
