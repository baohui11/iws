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

    def reconcile_pending_tasks(self, conn: psycopg.Connection, *, stale_after_seconds: int = 300) -> int:
        """Re-publish stale pending tasks whose original pgmq delivery was lost.

        The task row is authoritative; duplicate messages are safe because
        ``claim_message`` locks and validates the task before processing it.
        """
        stale_before = datetime.now(UTC) - timedelta(seconds=stale_after_seconds)
        with conn.cursor() as cur:
            cur.execute(
                """
                select id, file_id, stage
                from file_process_tasks
                where status = 'pending'
                  and run_after <= now()
                  and updated_at <= %s
                order by priority desc, created_at asc
                limit 100
                for update skip locked
                """,
                (stale_before,),
            )
            tasks = cur.fetchall()
            for task in tasks:
                payload = {
                    "version": 1,
                    "taskId": str(task["id"]),
                    "fileId": str(task["file_id"]),
                    "stage": task["stage"],
                }
                cur.execute(
                    "select * from pgmq.send(%s::text, %s::jsonb, %s::integer)",
                    (QUEUE_NAME, json.dumps(payload), 0),
                )
                sent = cur.fetchone()
                msg_id = sent.get("msg_id") if sent else None
                cur.execute(
                    """
                    update file_process_tasks
                    set pgmq_message_id = %s::bigint, updated_at = now()
                    where id = %s::uuid
                    """,
                    (msg_id, task["id"]),
                )
        conn.commit()
        return len(tasks)

    def enqueue_stage(
        self,
        conn: psycopg.Connection,
        *,
        file_id: str,
        stage: FileProcessStage,
        input_payload: dict[str, Any] | None = None,
    ) -> None:
        payload_input = json.dumps(input_payload or {"version": 1})
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into file_process_tasks (file_id, stage, status, input)
                values (%s::uuid, %s, 'pending', %s::jsonb)
                on conflict (file_id, stage) do nothing
                returning id
                """,
                (file_id, stage, payload_input),
            )
            row = cur.fetchone()
            if not row:
                conn.commit()
                return
            task_id = str(row["id"])
            message_payload = {
                "version": 1,
                "taskId": task_id,
                "fileId": file_id,
                "stage": stage,
            }
            cur.execute(
                "select * from pgmq.send(%s::text, %s::jsonb, %s::integer)",
                (QUEUE_NAME, json.dumps(message_payload), 0),
            )
            msg_row = cur.fetchone()
            msg_id = (
                msg_row.get("msg_id")
                or msg_row.get("send")
                or next(iter(msg_row.values()))
                if msg_row
                else None
            )
            cur.execute(
                """
                update file_process_tasks
                set pgmq_message_id = %s::bigint, updated_at = %s
                where id = %s::uuid
                """,
                (int(msg_id) if msg_id is not None else None, datetime.now(UTC), task_id),
            )
        conn.commit()

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
            or payload.get("stage") not in {"preview", "parse", "index", "embed"}
        ):
            self.ack(conn, message.message_id)
            return None

        now = datetime.now(UTC)
        stale_before = now - timedelta(seconds=self.settings.visibility_timeout_seconds)
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
                      t.locked_at,
                      f.project_id,
                      f.file_name,
                      f.file_size,
                      f.file_ext,
                      f.mime_type,
                      f.source_storage_key,
                      f.preview_storage_key
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
                ):
                    should_ack = True
                    claimed = None
                elif row["status"] == "processing" and (
                    not row["locked_at"] or row["locked_at"] > stale_before
                ):
                    should_ack = False
                    claimed = None
                elif row["status"] not in {"pending", "processing"}:
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
                    if row["stage"] == "preview":
                        cur.execute(
                            """
                            update files
                            set preview_status = 'processing',
                                processing_updated_at = %s,
                                updated_at = %s
                            where id = %s::uuid
                            """,
                            (now, now, row["file_id"]),
                        )
                    elif row["stage"] == "parse":
                        cur.execute(
                            """
                            update files
                            set parse_status = 'processing',
                                processing_updated_at = %s,
                                updated_at = %s
                            where id = %s::uuid
                            """,
                            (now, now, row["file_id"]),
                        )
                    elif row["stage"] == "index":
                        cur.execute(
                            """
                            update files
                            set index_status = 'processing',
                                processing_updated_at = %s,
                                updated_at = %s
                            where id = %s::uuid
                            """,
                            (now, now, row["file_id"]),
                        )
                    elif row["stage"] == "embed":
                        cur.execute(
                            """
                            update files
                            set embedding_status = 'processing',
                                processing_updated_at = %s,
                                updated_at = %s
                            where id = %s::uuid
                            """,
                            (now, now, row["file_id"]),
                        )
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
                        preview_storage_key=row["preview_storage_key"],
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
        else:
            conn.commit()
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
            elif stage == "embed":
                cur.execute(
                    """
                    update files
                    set
                      embedding_status = %s,
                      embedding_error = %s,
                      processing_updated_at = %s,
                      updated_at = %s
                    where id = %s::uuid
                    """,
                    (status, error_message, now, now, file_id),
                )
        conn.commit()

    def replace_file_document(
        self,
        conn: psycopg.Connection,
        *,
        file_id: str,
        content_text: str,
        parser_name: str,
        parser_version: str,
        language: str | None,
        metadata: dict[str, Any],
        chunks: list[dict[str, Any]],
    ) -> None:
        now = datetime.now(UTC)
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(
                    'delete from file_documents where file_id = %s::uuid',
                    (file_id,),
                )
                cur.execute(
                    """
                    insert into file_documents (
                      file_id,
                      content_text,
                      parser_name,
                      parser_version,
                      language,
                      metadata,
                      created_at,
                      updated_at
                    )
                    values (%s::uuid, %s, %s, %s, %s, %s::jsonb, %s, %s)
                    returning id
                    """,
                    (
                        file_id,
                        content_text,
                        parser_name,
                        parser_version,
                        language,
                        json.dumps(metadata, ensure_ascii=False),
                        now,
                        now,
                    ),
                )
                document_id = str(cur.fetchone()["id"])
                for idx, chunk in enumerate(chunks):
                    cur.execute(
                        """
                        insert into file_chunks (
                          file_id,
                          document_id,
                          chunk_index,
                          content,
                          page_no,
                          slide_no,
                          sheet_name,
                          row_start,
                          row_end,
                          section_title,
                          metadata,
                          created_at
                        )
                        values (
                          %s::uuid,
                          %s::uuid,
                          %s,
                          %s,
                          %s,
                          %s,
                          %s,
                          %s,
                          %s,
                          %s,
                          %s::jsonb,
                          %s
                        )
                        """,
                        (
                            file_id,
                            document_id,
                            int(chunk.get("chunk_index", idx)),
                            str(chunk.get("content") or ""),
                            chunk.get("page_no"),
                            chunk.get("slide_no"),
                            chunk.get("sheet_name"),
                            chunk.get("row_start"),
                            chunk.get("row_end"),
                            chunk.get("section_title"),
                            json.dumps(chunk.get("metadata") or {}, ensure_ascii=False),
                            now,
                        ),
                    )

    def update_file_chunk_search_vectors(
        self,
        conn: psycopg.Connection,
        *,
        file_id: str,
    ) -> int:
        with conn.cursor() as cur:
            cur.execute(
                """
                update file_chunks
                set search_vector = to_tsvector('jiebacfg', coalesce(content, ''))
                where file_id = %s::uuid
                """,
                (file_id,),
            )
            count = cur.rowcount
        conn.commit()
        return count

    def list_file_chunks_for_embedding(
        self,
        conn: psycopg.Connection,
        *,
        file_id: str,
    ) -> list[dict[str, Any]]:
        with conn.cursor() as cur:
            cur.execute(
                """
                select id, chunk_index, content
                from file_chunks
                where file_id = %s::uuid
                  and content is not null
                  and btrim(content) <> ''
                order by chunk_index asc
                """,
                (file_id,),
            )
            return list(cur.fetchall())

    def update_file_chunk_embeddings(
        self,
        conn: psycopg.Connection,
        *,
        file_id: str,
        rows: list[dict[str, Any]],
        embeddings: list[list[float]],
        model: str,
        dim: int,
    ) -> int:
        if len(rows) != len(embeddings):
            raise RuntimeError("Embedding row count mismatch")
        now = datetime.now(UTC)
        with conn.cursor() as cur:
            for row, vector in zip(rows, embeddings):
                vector_literal = "[" + ",".join(str(float(v)) for v in vector) + "]"
                cur.execute(
                    """
                    update file_chunks
                    set embedding = %s::vector,
                        embedding_model = %s,
                        embedding_dim = %s
                    where id = %s::uuid
                    """,
                    (vector_literal, model, dim, row["id"]),
                )
            cur.execute(
                """
                update files
                set embedding_model = %s,
                    embedding_dim = %s,
                    processing_updated_at = %s,
                    updated_at = %s
                where id = %s::uuid
                """,
                (model, dim, now, now, file_id),
            )
        conn.commit()
        return len(rows)

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
