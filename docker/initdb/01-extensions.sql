-- 首次初始化数据库时启用所需扩展。
-- 仅在数据卷为空时由官方镜像入口执行一次。

-- RAG 向量检索（pgvector，镜像已内置）
CREATE EXTENSION IF NOT EXISTS vector;

-- 模糊匹配 / 关键词检索辅助
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 说明：pgmq（队列）、pg_cron（定时）、zhparser/pg_jieba（中文分词）
-- 不在 pgvector 官方镜像中，后续如需启用，改用自定义 Dockerfile 安装这些扩展后再
-- CREATE EXTENSION。当前阶段先满足「PG 17 + 向量 + 模糊检索」。
