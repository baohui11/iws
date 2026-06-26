from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any

import psycopg
from psycopg.rows import dict_row

from .config import Settings
from .models import ClaimedTask, FileProcessStage, FileProcessTask, FileRow, QueueMessage

QUEUE_NAME = "file_processing"


class Repository:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def connect(self) -> psycopg.Connection:
        return psycopg.connect(self.settings.database_url, row_factory=dict_row)

    def read_messages(self, conn: psycopg.Connection) -> list[QueueMessage]:
        with conn.cursor() as cur:
            cur.execute(
                "select * from pgmq.read(%s::text, %s::integer, %s::integer)",
                (
                    QUEUE_NAME,
                    self.settings.visibility_timeout_seconds,
                    self.settings.max_messages,
                ),
            )
            rows = cur.fetchall()
        messages: list[QueueMessage] = []
        for row in rows:
            message = row.get("message")
            if isinstance(message, str):
                message = json.loads(message)
            if not isinstance(message, dict):
                message = {}
            messages.append(QueueMessage(message_id=str(row["msg_id"]), payload=message))
        return messages

    def ack(self, conn: psycopg.Connection, message_id: str) -> None:
        with conn.cursor() as cur:
            cur.execute(
                "select pgmq.delete(%s::text, %s::bigint)",
                (QUEUE_NAME, int(message_id)),
            )
        conn.commit()

    def requeue(
        self,
        conn: psycopg.Connection,
        payload: dict[str, Any],
        delay_seconds: int,
    ) -> str:
        with conn.cursor() as cur:
            cur.execute(
                "select * from pgmq.send(%s::text, %s::jsonb, %s::integer)",
                (QUEUE_NAME, json.dumps(payload), delay_seconds),
            )
            row = cur.fetchone()
        conn.commit()
        if not row:
            raise RuntimeError("pgmq.send returned no rows")
        value = row.get("msg_id") or row.get("send") or next(iter(row.values()))
        return str(value)

    def claim_message(
        self,
        conn: psycopg.Connection,
        message: QueueMessage,
    ) -> ClaimedTask | None:
        payload = message.payload
        if (
            payload.get("version") != 1
            or not isinstance(payload.get("taskId"), str)
            or not isinstance(payload.get("fileId"), str)
            or payload.get("stage") not in {"preview", "parse", "index"}
        ):
            self.ack(conn, message.message_id)
            return None

        now = datetime.now(UTC)
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select
                      t.id,
                      t.file_id,
                      t.stage,
                      t.status,
                      t.attempts,
                      t.max_attempts,
                      t.input,
                      f.project_id,
                      f.file_name,
                      f.file_size,
                      f.file_ext,
                      f.mime_type,
                      f.source_storage_key
                    from file_process_tasks t
                    join files f on f.id = t.file_id
                    where t.id = %s::uuid
                    for update skip locked
                    """,
                    (payload["taskId"],),
                )
                row = cur.fetchone()
                if not row:
                    should_ack = True
                    claimed = None
                elif (
                    str(row["file_id"]) != payload["fileId"]
                    or row["stage"] != payload["stage"]
                    or row["status"] != "pending"
                ):
                    should_ack = True
                    claimed = None
                else:
                    cur.execute(
                        """
                        update file_process_tasks
                        set
                          status = 'processing',
                          attempts = attempts + 1,
                          locked_by = %s,
                          locked_at = %s,
                          started_at = coalesce(started_at, %s),
                          updated_at = %s
                        where id = %s::uuid
                        returning attempts
                        """,
                        (
                            self.settings.worker_id,
                            now,
                            now,
                            now,
                            row["id"],
                        ),
                    )
                    updated = cur.fetchone()
                    attempts = int(updated["attempts"]) if updated else int(row["attempts"]) + 1
                    task = FileProcessTask(
                        id=str(row["id"]),
                        file_id=str(row["file_id"]),
                        stage=row["stage"],
                        status="processing",
                        attempts=attempts,
                        max_attempts=int(row["max_attempts"]),
                        input=row["input"] if isinstance(row["input"], dict) else None,
                    )
                    file_row = FileRow(
                        id=str(row["file_id"]),
                        project_id=str(row["project_id"]),
                        file_name=row["file_name"],
                        file_size=int(row["file_size"]),
                        file_ext=row["file_ext"],
                        mime_type=row["mime_type"],
                        source_storage_key=row["source_storage_key"],
                    )
                    should_ack = False
                    claimed = ClaimedTask(
                        message_id=message.message_id,
                        task=task,
                        file=file_row,
                        claimed_at=now,
                    )

        if should_ack:
            self.ack(conn, message.message_id)
        return claimed

    def mark_stage(
        self,
        conn: psycopg.Connection,
        *,
        file_id: str,
        stage: FileProcessStage,
        status: str,
        storage_key: str | None = None,
        output: dict[str, Any] | None = None,
        error_code: str | None = None,
        error_message: str | None = None,
    ) -> None:
        now = datetime.now(UTC)
        completed = now if status in {"ready", "failed", "skipped"} else None
        with conn.cursor() as cur:
            cur.execute(
                """
                update file_process_tasks
                set
                  status = %s,
                  output = %s::jsonb,
                  error_code = %s,
                  error_msg = %s,
                  completed_at = %s,
                  updated_at = %s
                where file_id = %s::uuid and stage = %s
                """,
                (
                    status,
                    json.dumps(output) if output is not None else None,
                    error_code,
                    error_message,
                    completed,
                    now,
                    file_id,
                    stage,
                ),
            )
            if stage == "preview":
                cur.execute(
                    """
                    update files
                    set
                      preview_status = %s,
                      preview_storage_key = %s,
                      preview_error = %s,
                      processing_updated_at = %s,
                      updated_at = %s
                    where id = %s::uuid
                    """,
                    (status, storage_key, error_message, now, now, file_id),
                )
            elif stage == "parse":
                cur.execute(
                    """
                    update files
                    set
                      parse_status = %s,
                      parsed_storage_key = %s,
                      parse_error = %s,
                      processing_updated_at = %s,
                      updated_at = %s
                    where id = %s::uuid
                    """,
                    (status, storage_key, error_message, now, now, file_id),
                )
            elif stage == "index":
                cur.execute(
                    """
                    update files
                    set
                      index_status = %s,
                      index_error = %s,
                      processing_updated_at = %s,
                      updated_at = %s
                    where id = %s::uuid
                    """,
                    (status, error_message, now, now, file_id),
                )
        conn.commit()

    def mark_retry(
        self,
        conn: psycopg.Connection,
        *,
        claimed: ClaimedTask,
        error_code: str,
        error_message: str,
        payload: dict[str, Any],
    ) -> None:
        delay_seconds = min(300, 10 * max(1, claimed.task.attempts))
        run_after = datetime.now(UTC) + timedelta(seconds=delay_seconds)
        msg_id = self.requeue(conn, payload, delay_seconds)
        with conn.cursor() as cur:
            cur.execute(
                """
                update file_process_tasks
                set
                  status = 'pending',
                  run_after = %s,
                  locked_by = null,
                  locked_at = null,
                  error_code = %s,
                  error_msg = %s,
                  pgmq_message_id = %s::bigint,
                  updated_at = %s
                where id = %s::uuid
                """,
                (
                    run_after,
                    error_code,
                    error_message,
                    int(msg_id),
                    datetime.now(UTC),
                    claimed.task.id,
                ),
            )
        conn.commit()

