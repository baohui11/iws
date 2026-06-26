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
    worker_id: str
    poll_interval_seconds: float
    visibility_timeout_seconds: int
    max_messages: int


def load_settings() -> Settings:
    _load_env_files()

    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is required")

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
        worker_id=os.getenv("FILE_WORKER_ID", "file-worker").strip(),
        poll_interval_seconds=float(
            os.getenv("FILE_WORKER_POLL_INTERVAL_SECONDS", "2")
        ),
        visibility_timeout_seconds=int(
            os.getenv("FILE_WORKER_VISIBILITY_TIMEOUT_SECONDS", "300")
        ),
        max_messages=int(os.getenv("FILE_WORKER_MAX_MESSAGES", "5")),
    )
