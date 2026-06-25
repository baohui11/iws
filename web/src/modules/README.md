# modules/ — 功能模块（feature-first）

按**业务域**组织，一个域的页面入口、业务、数据、校验、组件都在同一目录，避免改一个功能跨多个文件夹。

规划的域（7 个）：

| 模块 | 职责范围 | 主要表 |
|---|---|---|
| `auth` ✅ | 登录/会话/密码、当前用户、个人资料、头像 | users（认证字段） |
| `org` | 部门、用户、（新）组别；组织架构与人员管理（含 admin 视角的增删改/导入） | departments, users |
| `projects` | 项目、成员、合同成果清单；（新）合同信息、周期节点、填报开关 | projects, project_members, contract_deliverables |
| `weekly` | 周报、工作/计划事项、审批、无工作周豁免、周次、考勤 | weekly_reports, weekly_report_items, weekly_report_approvals, project_week_exemptions, weeks |
| `files` | 文件、版本、预览、互动(收藏/点赞/评论)、下载审计、参考关联、（新）分类标签、检索(RAG) | files, file_comments, file_interactions, file_download_record, file_reference_links, file_process_tasks |
| `stats` | 周报/文件/考勤/下载统计与导出 | （跨表只读聚合） |
| `notifications` | 站内通知（横切，多域触发） | notifications |

> **没有单独的 `admin` 模块**：管理后台只是「按 admin 角色授权的页面」，其能力由 `org`/`projects` 等域的 service 提供。`/admin/*` 路由组合这些 service，在传输层/页面做角色门禁。
> OA 同步等外部集成后续可新增 `integrations` 模块。

## 单个模块的标准结构

```
modules/<域>/
  service.ts      # 业务规则 + 鉴权（调 core/auth 的 requireUser/policy）。不依赖框架运行时与具体基础设施
  repo.ts         # 数据访问（Drizzle）。仅此层接触 DB
  schema.ts       # zod 入参校验
  types.ts        # 域内类型（尽量从 db schema 推导）
  components/      # 仅本域使用的 UI 组件（feature-first）
  (action.ts / router.ts)  # 薄传输层：zod 解析入参 → service → run() 包 Result
```

## 分层与依赖规则

```
app/(页面) · components/(共享 UI)
        │
传输层  tRPC router / REST route / (薄) action  →  调 service
        │
领域层  modules/<域>/service  →  鉴权 + 业务；调 repo 与 core/ports
        │
数据层  modules/<域>/repo     →  Drizzle
```

- **传输层薄**：只做「解析入参 → 调 service → `run()`」，无业务逻辑。
- **service 与框架解耦**：参数为「纯入参 + 当前用户」，不碰 `cookies()` / `NextRequest` / `revalidatePath`。
  - 收益：同一 service 可同时挂 tRPC（对内）与 REST（对外）。
- **数据访问只在 repo**：任何地方不出现裸 `supabase.from()`。

## 前端组件归属

- 只被某个域使用 → 放进 `modules/<域>/components/`。
- 被 ≥2 个域共用的纯 UI 基础件 → 放 `src/components/ui/`。
