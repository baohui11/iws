# AGENTS.md

> 本文件是 AI 协作的项目规则。Cursor 会自动加载根目录的 `AGENTS.md`。
> （用户口头称其为 AGENT.md；此处用 Cursor 识别的标准文件名 `AGENTS.md`。）

## 0. 这个分支是什么

- `refactor/architecture-v2` 是**全新重写**分支，工作区里**不包含旧应用代码**。
- 旧实现（周报/文件/统计/管理等全部业务）保存在 **`main` 分支**，仅作**参照**。

### 如何参照旧代码（不要把旧代码拷回本分支结构）

```bash
# 查看某个旧文件
git show main:src/actions/weekly/report-editor.action.ts

# 列出旧目录
git ls-tree main:src/lib/db/weekly

# 临时把某旧文件取到本地查看（看完请勿提交进新结构）
git show main:src/lib/db/weekly/reports.ts > _ref_reports.ts
```

- 旧代码只用来**抽取业务规则 / 数据形态 / 边界条件**，再按新架构（见下）重写，**不照搬旧结构与旧写法**。
- 旧业务/产品文档同样在 `main` 的 `docs/` 下（如 PRD、用户部门项目、系统周报介绍、检索接口文档）。

## 1. 设计文档（先读）

- `docs/重构设计方案.md` — 分层、约定、路线图
- `docs/功能清单与规划.md` — 现有功能 + 新增功能
- `docs/目标架构.md` — 重构后的目标技术架构

## 2. 架构与分层（强约束）

```
表现层  app/(页面) · components/(共享 UI)
应用层  传输层(薄): tRPC router / REST route / (薄)action —— zod 解析入参 → service → run()
领域层  modules/<域>/service —— 业务规则 + 鉴权；不依赖框架运行时与具体基础设施
数据层  modules/<域>/repo —— Drizzle
基础设施 core/ports + core/adapters —— Storage/Search/Parser/Preview/Queue/Embedding
```

- **feature-first**：一个域的 service/repo/schema/types/components 都在 `src/modules/<域>/`。
- 依赖方向只能 `modules/ → core/`，**禁止 `core/ → modules/`**。
- 组件归属：单域用 → `modules/<域>/components/`；多域共用纯 UI → `src/components/ui/`。

## 3. 编码规则

- **传输层薄**：只做「zod 解析入参 → 调 service → `run()` 包 `Result`」，不写业务逻辑。
- **service 与框架解耦**：参数为「纯入参 + 当前用户」，**不碰** `cookies()` / `NextRequest` / `revalidatePath`。
- **数据访问只在 repo 层**，用 Drizzle；**任何地方不得出现裸 `supabase.from()` 或直连 SQL 字符串拼接**。
- **错误**：一律抛 `@/core/errors` 的 `AppError` 子类（AuthError/ValidationError/NotFoundError/BusinessError）。
- **返回**：传输层用 `@/core/result` 的 `run()` 统一转 `Result<T>`（带稳定 `code`）。
- **鉴权**：用 `@/core/auth` 的 `requireUser()` 与 `policy`，不要在各处复制登录/权限判断。
- **类型来源**：以 Drizzle schema（`src/core/db/schema`，`pnpm db:pull` 生成）为唯一事实来源，避免手写漂移。
- 不写无意义的「叙述式」注释；注释只解释非显而易见的意图/约束。

## 4. 技术栈（已定）

- Next.js 16 (App Router) + React 19 + HeroUI + Tailwind
- 数据：自建 PostgreSQL 17 + Drizzle ORM；RAG 用 pgvector + 关键词(BM25/全文) 混合检索
- 认证：Auth.js + bcrypt（替代 Supabase Auth）
- 存储：MinIO（S3 兼容，+ 可选加密网关）
- 队列：pgmq（+ pg_cron 定时）
- 文档预览：Gotenberg（Office→PDF）；解析(RAG)：自建微服务（OCR 走线上 API）→ Markdown
- 对内传输 tRPC，对外 REST(`/api/v1`) + OpenAPI

## 5. 环境与命令

- 本机 shell 为 **PowerShell**：命令**不要用 `&&`**，用 `;` 或分多次执行。
- 包管理：**pnpm**。
- 数据库：`docker/` 下 `docker compose up -d` 起 PostgreSQL 17；`DATABASE_URL` 见 `docker/.env.example`。

```bash
pnpm db:pull       # 从现有库反向生成 Drizzle schema
pnpm db:generate   # 生成迁移
pnpm db:migrate    # 执行迁移
npx tsc --noEmit   # 类型检查
```

## 6. Git

- 仅在用户明确要求时才提交（commit）。
- 不改 git 配置；不强推 `main`。
