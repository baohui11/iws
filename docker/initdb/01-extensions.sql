-- 首次初始化数据库时启用所需扩展。
-- 仅在数据卷为空时由官方镜像入口执行一次。

-- RAG 向量检索（pgvector，镜像已内置）
CREATE EXTENSION IF NOT EXISTS vector;

-- 模糊匹配 / 关键词检索辅助
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 消息队列（pgmq）
CREATE EXTENSION IF NOT EXISTS pgmq;

-- 定时任务（pg_cron；需 shared_preload_libraries，见 docker-compose.yml command）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 中文全文检索分词
CREATE EXTENSION IF NOT EXISTS zhparser;
CREATE EXTENSION IF NOT EXISTS pg_jieba;
