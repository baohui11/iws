# Docker 部署

镜像基于 Next.js [`output: "standalone"`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)，体积小、适合生产。

## 准备环境变量

1. 在**仓库根目录**将 `.env.example` 复制为 `.env`（或把现有 `.env.local` 复制为 `.env`）。
2. 至少填写 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`，以及服务端密钥（如 `SUPABASE_SERVICE_ROLE_KEY`、检索与加密相关变量等）。  
   在仓库根目录执行 `docker compose` 时，会读取**根目录** `.env`（与 `NEXT_PUBLIC_*` 构建参数一致）。

## 构建并启动

在**仓库根目录**执行（使用根目录 `compose.yaml`，与 `docker/.env` 无关）：

```bash
docker compose up --build -d
```

默认映射 `3000` 端口。修改宿主机端口：

```bash
EXPOSE_PORT=8080 docker compose up --build -d
```

若仍使用 `docker/docker-compose.yml`，Compose 会把 `${NEXT_PUBLIC_*}` 从 **`docker/.env`** 解析，而不是根目录 `.env`。可改用：

```bash
docker compose --env-file .env -f docker/docker-compose.yml up --build -d
```

## 仅构建镜像

```bash
docker build -f docker/Dockerfile \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -t iws:latest ..
```

## 说明

- **临时目录**：容器内需可写目录时，在 `.env` 中设置 `IWS_TEMP_DIR`（例如 `/tmp/iws`），并保证与加密系统路径约定一致。
- **变更 `NEXT_PUBLIC_*`**：需重新执行带 `--build` 的构建，客户端才会拿到新值。
