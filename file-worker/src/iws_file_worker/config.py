from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


def _load_env_files() -> None:
    root = Path(__file__).resolve().parents[3]
    load_dotenv(root / "web" / ".env", override=False)
    load_dotenv(root / "file-worker" / ".env", override=True)


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_url: str
    s3_endpoint: str
    s3_region: str
    s3_access_key: str
    s3_secret_key: str
    s3_project_files_bucket: str
    s3_force_path_style: bool
    gotenberg_url: str
    gotenberg_convert_timeout_seconds: int
    worker_id: str
    poll_interval_seconds: float
    visibility_timeout_seconds: int
    max_messages: int
    preview_concurrency: int
    parse_concurrency: int
    index_concurrency: int
    embed_concurrency: int
    paddleocr_token: str
    paddleocr_job_url: str
    paddleocr_model: str
    paddleocr_poll_interval_seconds: int
    paddleocr_max_wait_seconds: int
    paddleocr_max_pdf_pages_per_job: int
    embedding_api_key: str
    embedding_api_url: str
    embedding_model: str
    embedding_dim: int
    embedding_batch_size: int
    embedding_service_host: str
    embedding_service_port: int
    embedding_service_token: str


def load_settings() -> Settings:
    _load_env_files()

    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is required")

    preview_concurrency = int(os.getenv("FILE_WORKER_PREVIEW_CONCURRENCY", "3"))
    parse_concurrency = int(os.getenv("FILE_WORKER_PARSE_CONCURRENCY", "12"))
    index_concurrency = int(os.getenv("FILE_WORKER_INDEX_CONCURRENCY", "6"))
    embed_concurrency = int(os.getenv("FILE_WORKER_EMBED_CONCURRENCY", "6"))
    default_max_messages = str(
        preview_concurrency
        + parse_concurrency
        + index_concurrency
        + embed_concurrency
    )

    return Settings(
        database_url=database_url,
        s3_endpoint=os.getenv("S3_ENDPOINT", "http://localhost:9000").strip(),
        s3_region=os.getenv("S3_REGION", "us-east-1").strip(),
        s3_access_key=os.getenv("S3_ACCESS_KEY", "").strip(),
        s3_secret_key=os.getenv("S3_SECRET_KEY", "").strip(),
        s3_project_files_bucket=os.getenv(
            "S3_PROJECT_FILES_BUCKET", "project-files"
        ).strip(),
        s3_force_path_style=_bool_env("S3_FORCE_PATH_STYLE", True),
        gotenberg_url=os.getenv("GOTENBERG_URL", "http://localhost:3001").strip(),
        gotenberg_convert_timeout_seconds=max(
            30, int(os.getenv("GOTENBERG_CONVERT_TIMEOUT_SECONDS", "600"))
        ),
        worker_id=os.getenv("FILE_WORKER_ID", "file-worker").strip(),
        poll_interval_seconds=float(
            os.getenv("FILE_WORKER_POLL_INTERVAL_SECONDS", "2")
        ),
        visibility_timeout_seconds=int(
            os.getenv("FILE_WORKER_VISIBILITY_TIMEOUT_SECONDS", "300")
        ),
        max_messages=int(os.getenv("FILE_WORKER_MAX_MESSAGES", default_max_messages)),
        preview_concurrency=max(1, preview_concurrency),
        parse_concurrency=max(1, parse_concurrency),
        index_concurrency=max(1, index_concurrency),
        embed_concurrency=max(1, embed_concurrency),
        paddleocr_token=os.getenv("PADDLEOCR_TOKEN", "").strip(),
        paddleocr_job_url=os.getenv(
            "PADDLEOCR_JOB_URL",
            "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs",
        ).strip(),
        paddleocr_model=os.getenv("PADDLEOCR_MODEL", "PaddleOCR-VL-1.6").strip(),
        paddleocr_poll_interval_seconds=int(
            os.getenv("PADDLEOCR_POLL_INTERVAL_SECONDS", "5")
        ),
        paddleocr_max_wait_seconds=int(os.getenv("PADDLEOCR_MAX_WAIT_SECONDS", "1800")),
        paddleocr_max_pdf_pages_per_job=max(
            1, int(os.getenv("PADDLEOCR_MAX_PDF_PAGES_PER_JOB", "100"))
        ),
        embedding_api_key=os.getenv("DASHSCOPE_API_KEY", "").strip(),
        embedding_api_url=os.getenv(
            "EMBEDDING_API_URL",
            "https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding",
        ).strip(),
        embedding_model=os.getenv("EMBEDDING_MODEL", "text-embedding-v4").strip(),
        embedding_dim=int(os.getenv("EMBEDDING_DIM", "1536")),
        embedding_batch_size=int(os.getenv("EMBEDDING_BATCH_SIZE", "10")),
        embedding_service_host=os.getenv("EMBEDDING_SERVICE_HOST", "0.0.0.0").strip(),
        embedding_service_port=int(os.getenv("EMBEDDING_SERVICE_PORT", "8010")),
        embedding_service_token=os.getenv("EMBEDDING_SERVICE_TOKEN", "").strip(),
    )
