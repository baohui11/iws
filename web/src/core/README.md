# core/ — 跨域基础设施与约定

本目录是所有功能模块共享的地基。**依赖方向只能由 `modules/` → `core/`，禁止 `core/` 反向依赖 `modules/`。**

## 目录

| 路径 | 职责 |
|---|---|
| `result.ts` | 统一返回类型 `Result<T>` 与执行包装 `run()` |
| `errors.ts` | 统一错误体系（`AppError` + 子类，带 `code` / `httpStatus` / `expose`） |
| `auth/` | 当前用户上下文 `requireUser()/getCurrentUser()` 与鉴权策略 `policy` |
| `db/` | Drizzle client（`getDb()`）+ `schema/`（由 `db:pull` 生成） |
| `ports/` | 基础设施端口接口：Storage / Search / Parser / Preview / Queue / Embedding |
| `adapters/`（待建） | 各端口的具体实现（先包装现有 Supabase，再逐步替换） |

## 约定

- **service 只依赖 `core/` 的接口（port）与 `auth`/`result`/`errors`**，不直接 import 具体基础设施（supabase / drizzle 细节 / next 运行时）。
- **基础设施可替换**：换 DB / 存储 / 检索 / 解析时，只改 `core/adapters/` 实现，业务零改动。
- 错误一律抛 `AppError` 子类；传输层用 `run()` 统一转成 `Result`。

## 数据库 schema 生成

```bash
# 配置 DATABASE_URL 后，从现有库反向生成 Drizzle schema
pnpm db:pull
```
