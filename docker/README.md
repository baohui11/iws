# Docker 部署说明

本目录用于启动 IWS 的完整运行环境。

## 服务组成

- `web`：Next.js 应用，启动时自动执行数据库迁移、初始化管理员，并运行 OA 定时同步。
- `file-worker`：文件预览、解析、索引、OCR 和向量化服务。
- `postgres`：PostgreSQL 17，包含 pgvector、pgmq、pg_cron、pg_jieba 等扩展。
- `minio`：S3 兼容对象存储。
- `gotenberg`：Office / PPT 转 PDF 服务。

## 启动

服务器运行只依赖镜像，不在服务器上构建：

```powershell
cd E:\app\iws\docker
Copy-Item .env.example .env
docker compose up -d
```

## 本地构建镜像

本地开发机有外网时，使用 build override 生成镜像：

```powershell
cd E:\app\iws\docker
docker compose -f docker-compose.yml -f docker-compose.build.yml build
```

也可以边构建边启动：

```powershell
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

导出需要传到服务器的镜像：

```powershell
docker save -o iws-images.tar `
  iws-postgres:latest `
  iws-web:latest `
  iws-file-worker:latest `
  minio/minio:RELEASE.2025-04-22T22-12-26Z `
  gotenberg/gotenberg:8
```

服务器导入：

```powershell
docker load -i iws-images.tar
cd /path/to/iws/docker
docker compose up -d
```

查看状态：

```powershell
docker compose ps
```

查看日志：

```powershell
docker compose logs -f web
docker compose logs -f file-worker
```

## 数据库迁移

`web` 容器启动时，如果配置：

```env
RUN_DB_MIGRATIONS=true
```

会先执行：

```text
node scripts/migrate-runtime.mjs
```

迁移使用 Drizzle 的迁移记录表，已经执行过的迁移不会重复执行。

生产环境如部署多个 Web 实例，应只让一个实例执行迁移，或把迁移改为单独的一次性任务。

## 初始管理员

迁移完成后，如果配置：

```env
SEED_ADMIN_ON_STARTUP=true
SEED_ADMIN_EMAIL=admin@iws.local
SEED_ADMIN_PASSWORD=admin12345
```

系统会检查数据库中是否已有未删除的管理员：

- 已有管理员：跳过。
- 没有管理员，但存在同邮箱用户：提升该用户为管理员。
- 没有管理员，也没有同邮箱用户：创建初始管理员。

## OA 同步定时任务

OA 同步运行在 `web` 容器内，不需要单独的 OA worker 容器。

默认每天 04:00 和 13:00 执行：

```env
OA_SYNC_SCHEDULE_ENABLED=true
OA_SYNC_SCHEDULE_CRON=0 4,13 * * *
```

同步顺序：

```text
部门 -> 用户 -> 项目 -> 项目角色
```

## 重置本地数据

以下命令会删除数据库和 MinIO 文件数据：

```powershell
cd E:\app\iws\docker
docker compose down -v
docker compose up -d
```

## 生产必改配置

上线前至少修改：

- `AUTH_SECRET`
- `FILE_UPLOAD_TOKEN_SECRET`
- `APP_BASE_URL`
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `POSTGRES_PASSWORD`
- `MINIO_ROOT_PASSWORD`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `OA_PGREST_TOKEN`
- `PADDLEOCR_TOKEN`
- `DASHSCOPE_API_KEY`

不要把真实密钥提交到 `.env.example`。
