# 周报文件系统 IWS

IWS 是面向公司内部项目管理、周报填报和项目文件检索的业务系统。系统围绕 OA 同步的组织、用户、项目和项目成员数据，提供项目周报、成果文件、销售资料、权限控制、文件预览、全文检索和语义检索能力。

## 主要能力

- OA 数据同步：部门、用户、项目、项目成员。
- 项目周报：个人填报、项目经理审批、撤回、删除草稿和个人考勤导出。
- 项目文件：成果文件、参考资料、销售资料上传、预览、下载和互动。
- 文件检索：元数据、全文关键词、向量语义和混合检索。
- 数据统计：周报、文件、考勤、下载等统计视图。
- 系统管理：部门、用户、项目、数据权限和 OA 同步记录。
- 权限控制：系统管理员、部门管理员、部门领导、BP、公司领导和普通用户。

## 技术栈

- Web：Next.js 16、React 19、HeroUI、Tailwind CSS
- 数据库：PostgreSQL 17、Drizzle ORM、pgvector、pgmq、pg_cron、pg_jieba
- 认证：自建账号密码认证、bcrypt、Session Cookie
- 存储：MinIO / S3 兼容存储，可接入加密网关作为公开访问端点
- 文件处理：Gotenberg、Python file-worker、PaddleOCR、DashScope text-embedding-v4
- 部署：Docker Compose

## 目录结构

```text
iws/
├─ web/                 # Next.js 应用
├─ file-worker/         # Python 文件处理、解析、索引、向量化服务
├─ docker/              # Docker Compose、PostgreSQL 镜像与部署配置
├─ docs/                # 项目文档
└─ AGENTS.md            # AI 协作规则
```

## 快速启动

推荐用 Docker 启动完整环境：

```powershell
cd E:\app\iws\docker
Copy-Item .env.example .env
docker compose up -d --build
```

启动后访问：

```text
http://localhost:3000
```

首次启动时 `web` 容器会自动执行数据库迁移，并在没有管理员账号时创建初始管理员。默认账号密码来自 `docker/.env`：

```env
SEED_ADMIN_EMAIL=admin@iws.local
SEED_ADMIN_PASSWORD=admin12345
```

## 本地开发

仅开发 Web 时，可先启动基础设施：

```powershell
cd E:\app\iws\docker
docker compose up -d postgres minio gotenberg
```

再启动 Web：

```powershell
cd E:\app\iws\web
Copy-Item .env.example .env
pnpm install
pnpm dev
```

常用命令：

```powershell
pnpm exec tsc --noEmit
pnpm build
pnpm db:migrate
pnpm db:seed
```

## 文档

- [项目概览](docs/01-项目概览.md)
- [系统架构](docs/02-系统架构.md)
- [本地开发](docs/03-本地开发.md)
- [Docker 部署](docs/04-Docker部署.md)
- [配置说明](docs/05-配置说明.md)
- [权限模型](docs/06-权限模型.md)
- [OA 同步](docs/07-OA同步.md)
- [文件处理与检索](docs/08-文件处理与检索.md)
- [上线检查清单](docs/09-上线检查清单.md)

旧的重构过程文档已移动到 `docs/_legacy_refactor_docs/`。

## 部署说明

生产环境建议：

- 使用强随机 `AUTH_SECRET` 和 `FILE_UPLOAD_TOKEN_SECRET`。
- 修改默认管理员账号和密码。
- 配置正式 `APP_BASE_URL`。
- 配置 SMTP、OA PgREST Token、PaddleOCR Token、DashScope API Key。
- 保持数据库迁移只由一个 `web` 实例执行。
- 如需多副本部署 Web，OA 定时任务应只在一个实例开启。

## 许可证

内部项目，仅限公司内部使用。
