# 历史 Supabase 数据迁移

这个目录用于一次性把旧 Supabase 系统的数据迁移到当前 PostgreSQL + MinIO 架构。迁移脚本后续都放在这里，避免侵入 `web/` 和 `file-worker/` 的业务代码。

## 你需要提供的配置

复制环境变量模板：

```powershell
Copy-Item legacy-migration/.env.example legacy-migration/.env
```

然后填写 `legacy-migration/.env`。

必须提供：

- `LEGACY_DATABASE_URL`：旧 Supabase PostgreSQL 连接串，建议只读账号。
- `LEGACY_SUPABASE_STORAGE_LOCAL_ROOT`：旧 Supabase Storage 物理目录，指向 `stub/stub` 这一层。
- `TARGET_DATABASE_URL`：新系统 PostgreSQL 连接串。
- `TARGET_S3_ENDPOINT`：新 MinIO/S3 服务端访问地址。
- `TARGET_S3_ACCESS_KEY` / `TARGET_S3_SECRET_KEY`：新 MinIO/S3 凭据。
- `TARGET_S3_PROJECT_FILES_BUCKET`：新项目文件 bucket。
- `TARGET_S3_AVATAR_BUCKET`：新头像 bucket。

建议先保持：

```env
MIGRATION_DRY_RUN=true
```

等旧表结构、数据量、文件路径规则确认后，再关闭 dry-run 正式迁移。

## 迁移原则

- 脚本必须可重复执行。
- 优先按业务唯一键匹配：部门 code、用户 employee_no/email、项目 project_no。
- 业务数据从旧 Supabase PostgreSQL 读取。
- 文件对象从旧 Supabase Storage 本地物理目录读取，再上传到新 MinIO。
- 文件迁移后不复用旧解析结果，默认写入新系统文件处理任务，让 `file-worker` 重新生成预览、解析、分块、索引。
- 迁移过程会输出日志和统计报告，便于人工核对。

## 后续脚本规划

```text
legacy-migration/
  .env.example
  README.md
  src/
    config.ts
    legacy-db.ts
    target-db.ts
    target-storage.ts
    inspect.ts
    migrate-departments.ts
    migrate-users.ts
    migrate-projects.ts
    migrate-project-members.ts
    migrate-weekly-reports.ts
    migrate-files.ts
    migrate-all.ts
```

第一步会先写 `inspect.ts`，连接旧库读取表结构、行数、关键字段样例、Storage 对象数量和路径分布，再根据实际结构定字段映射。

## 注意

- 不要把 `legacy-migration/.env` 提交到 Git。
- 旧 Supabase 连接建议使用只读账号。
- 正式迁移前建议先在一套空的新库和空 MinIO bucket 上完整演练。

## 从本地 Supabase Storage 目录补齐文件

把旧 Supabase Storage 底层目录拷贝到本地后，可以使用本地目录补齐新
MinIO 中缺失的项目文件。

配置：

```env
LEGACY_SUPABASE_STORAGE_LOCAL_ROOT=E:\app\iws\temp\storage\stub\stub
```

先 dry-run 小批量检查：

```powershell
$env:LOCAL_STORAGE_COPY_LIMIT='20'
$env:LOCAL_STORAGE_COPY_DRY_RUN='true'
node legacy-migration/src/copy-local-storage-files.mjs
```

确认后小批量真实上传：

```powershell
$env:LOCAL_STORAGE_COPY_LIMIT='20'
$env:LOCAL_STORAGE_COPY_DRY_RUN='false'
node legacy-migration/src/copy-local-storage-files.mjs
```

脚本会跳过目标 MinIO 已存在对象，只补 `files.source_storage_key` 指向的缺失对象。

全量补齐时可以把 limit 设为 `0`：

```powershell
$env:LOCAL_STORAGE_COPY_LIMIT='0'
$env:LOCAL_STORAGE_COPY_DRY_RUN='false'
node legacy-migration/src/copy-local-storage-files.mjs
```

## 文件处理任务入队

文件对象补齐后，可以把文件处理任务写入 `file_process_tasks` 并发送到
`pgmq` 的 `file_processing` 队列。

先 dry-run：

```powershell
$env:FILE_PROCESS_ENQUEUE_LIMIT='20'
$env:FILE_PROCESS_STAGES='preview,parse'
$env:FILE_PROCESS_ENQUEUE_DRY_RUN='true'
node legacy-migration/src/enqueue-file-processing.mjs
```

小批量真实入队：

```powershell
$env:FILE_PROCESS_ENQUEUE_LIMIT='20'
$env:FILE_PROCESS_STAGES='preview,parse'
$env:FILE_PROCESS_ENQUEUE_DRY_RUN='false'
node legacy-migration/src/enqueue-file-processing.mjs
```

全量入队同样把 limit 设为 `0`。脚本默认要求目标 MinIO 已存在源文件对象，
避免把缺文件的记录送进 worker。
