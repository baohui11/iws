# Docker 部署

## 启动

```powershell
cd E:\app\iws\docker
Copy-Item .env.example .env
docker compose up -d --build
```

查看服务：

```powershell
docker compose ps
```

查看日志：

```powershell
docker compose logs -f web
docker compose logs -f file-worker
```

## 服务列表

- `web`：Next.js 应用，自动迁移数据库、初始化管理员、执行 OA 定时同步。
- `file-worker`：文件预览、解析、索引、OCR、向量化。
- `postgres`：PostgreSQL 17。
- `minio`：S3 兼容对象存储。
- `gotenberg`：Office 转 PDF。

## 首次启动流程

`web` 容器启动时会按顺序执行：

1. `node scripts/migrate-runtime.mjs`
2. `node scripts/seed-admin.mjs`
3. `node server.js`

相关变量：

```env
RUN_DB_MIGRATIONS=true
SEED_ADMIN_ON_STARTUP=true
```

迁移由 Drizzle 管理，已执行过的迁移不会重复执行。

## 初始化管理员

当数据库没有未删除的管理员时，系统会创建或提升初始管理员：

```env
SEED_ADMIN_EMAIL=admin@iws.local
SEED_ADMIN_PASSWORD=admin12345
```

规则：

- 已有 admin：跳过。
- 没有 admin，但存在同邮箱用户：提升为 admin。
- 没有 admin，也没有同邮箱用户：创建 admin。

## 重置本地环境

危险操作，会删除数据库和文件数据：

```powershell
cd E:\app\iws\docker
docker compose down -v
docker compose up -d --build
```

## 生产建议

- 不要使用默认密码。
- 生产环境设置强随机 `AUTH_SECRET`。
- 生产环境设置强随机 `FILE_UPLOAD_TOKEN_SECRET`。
- `APP_BASE_URL` 使用真实访问地址。
- 仅一个 Web 实例执行迁移和 OA 定时任务。
- MinIO 数据卷、PostgreSQL 数据卷需要纳入备份。
