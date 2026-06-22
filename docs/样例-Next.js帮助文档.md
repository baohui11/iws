# Next.js 应用说明（样例 · 节选）

> **说明**：本文为**内部开发向**简版帮助，仅覆盖本仓库常见约定；完整手册请结合 [Next.js 官方文档](https://nextjs.org/docs) 与项目实际目录补全。

---

## 1. 技术栈与版本（示例）

| 项 | 说明 |
|----|------|
| 框架 | Next.js（App Router） |
| UI | React + HeroUI 等 |
| 数据 | Supabase（Postgres / Auth / Storage） |
| 部署 | Node 生产镜像 / 容器（以实际流水线为准） |

---

## 2. 目录约定（节选）

| 路径（示例） | 用途 |
|--------------|------|
| `src/app/` | 路由与页面；`layout.tsx`、`page.tsx`、`route.ts` |
| `src/actions/` | Server Actions（业务写入、经 `handleAction` 统一错误） |
| `src/lib/db/` | 数据访问；仅 Supabase 查询，错误走 `handleDbError` |
| `src/lib/supabase/` | 浏览器 / 服务端 / Admin 客户端创建方式 |
| `src/components/` | 可复用组件 |

---

## 3. 环境变量（节选）

- **`NEXT_PUBLIC_*`**：会打进前端包，勿放密钥。  
- **服务端专用**：如 `SUPABASE_SERVICE_ROLE_KEY`、检索/加密服务地址等，仅服务器可读。  
- 若区分内网访问 Supabase，可增设 **`SUPABASE_SERVICE_URL`**（服务端）与 **`NEXT_PUBLIC_SUPABASE_URL`**（浏览器）并存，详见项目 `.env.example`。

---

## 4. 常见开发任务（示例）

**本地启动（示例命令，以 `package.json` 为准）**

```bash
pnpm install
pnpm dev
```

**新增一个受保护页面**

- 路由级登录校验通常由中间件（如 `proxy`）统一处理；页面内只做角色或数据权限判断。

**新增写入接口**

- 优先使用 **Server Action** + `handleAction`，内部 `verify` 权限后调用 `lib/db`。

---

## 5. 构建与注意事项（节选）

- 生产构建前确认环境变量在部署平台已配置。  
- 大文件上传、服务端耗时任务需关注 **请求体大小限制** 与 **Supabase Storage 单文件上限**（二者可能不同）。  
- 静态资源与 `next/image` 域名白名单按部署文档配置。

---

## 6. 延伸阅读（占位）

- 项目内专项文档：检索服务、Docker、加密链路等。  
- 升级 Next.js 主版本前请阅读官方 Migration 指南并做回归。

---

*（样例结束：可补充故障排查清单、分支策略、Code Review 规范等。）*
