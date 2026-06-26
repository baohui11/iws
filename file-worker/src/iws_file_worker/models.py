from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

FileProcessStage = Literal["preview", "parse", "index"]


@dataclass(frozen=True)
class QueueMessage:
    message_id: str
    payload: dict[str, Any]


@dataclass(frozen=True)
class FileProcessTask:
    id: str
    file_id: str
    stage: FileProcessStage
    status: str
    attempts: int
    max_attempts: int
    input: dict[str, Any] | None


@dataclass(frozen=True)
class FileRow:
    id: str
    project_id: str
    file_name: str
    file_size: int
    file_ext: str | None
    mime_type: str | None
    source_storage_key: str


@dataclass(frozen=True)
class ClaimedTask:
    message_id: str
    task: FileProcessTask
    file: FileRow
    claimed_at: datetime
