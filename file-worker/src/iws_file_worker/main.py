from __future__ import annotations

import logging
import signal
import time
from types import FrameType

from .config import load_settings
from .embedding import EmbeddingClient, start_embedding_http_server
from .parse import ParseProcessor
from .processor import TaskProcessor
from .repository import Repository
from .storage import ObjectStorage
from .preview import PreviewProcessor, PreviewResult

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s - %(message)s"


class StopSignal:
    def __init__(self) -> None:
        self.stop = False

    def handle(self, _signum: int, _frame: FrameType | None) -> None:
        self.stop = True


def run_once(repo: Repository, processor: TaskProcessor, embedding_client: EmbeddingClient) -> bool:
    processed_any = False
    with repo.connect() as conn:
        messages = repo.read_messages(conn)
        if not messages:
            return False
        processed_any = True

        for message in messages:
            claimed = repo.claim_message(conn, message)
            if not claimed:
                continue
            processed_any = True

            logging.info(
                "processing task=%s file=%s stage=%s attempt=%s/%s",
                claimed.task.id,
                claimed.file.id,
                claimed.task.stage,
                claimed.task.attempts,
                claimed.task.max_attempts,
            )
            try:
                result = processor.process(claimed)
                if claimed.task.stage == "parse" and result.status == "ready":
                    repo.replace_file_document(
                        conn,
                        file_id=claimed.file.id,
                        content_text=result.content_text,
                        parser_name=result.parser_name,
                        parser_version=result.parser_version,
                        language=result.language,
                        metadata=result.metadata,
                        chunks=[
                            {
                                "chunk_index": c.chunk_index,
                                "content": c.content,
                                "page_no": c.page_no,
                                "slide_no": c.slide_no,
                                "sheet_name": c.sheet_name,
                                "row_start": c.row_start,
                                "row_end": c.row_end,
                                "section_title": c.section_title,
                                "metadata": c.metadata,
                            }
                            for c in result.chunks
                        ],
                    )
                    repo.enqueue_stage(conn, file_id=claimed.file.id, stage="index")
                if claimed.task.stage == "index" and result.status == "ready":
                    count = repo.update_file_chunk_search_vectors(
                        conn,
                        file_id=claimed.file.id,
                    )
                    repo.enqueue_stage(conn, file_id=claimed.file.id, stage="embed")
                    result = PreviewResult(
                        status="ready",
                        output={"version": 1, "indexed_chunks": count},
                    )
                if claimed.task.stage == "embed":
                    chunk_rows = repo.list_file_chunks_for_embedding(
                        conn,
                        file_id=claimed.file.id,
                    )
                    if not chunk_rows:
                        result = PreviewResult(
                            status="skipped",
                            output={"version": 1, "reason": "no_chunks"},
                        )
                    elif not embedding_client.enabled:
                        result = PreviewResult(
                            status="skipped",
                            output={"version": 1, "reason": "embedding_not_configured"},
                        )
                    else:
                        embedding = embedding_client.embed(
                            [str(row["content"]) for row in chunk_rows],
                            text_type="document",
                        )
                        count = repo.update_file_chunk_embeddings(
                            conn,
                            file_id=claimed.file.id,
                            rows=chunk_rows,
                            embeddings=embedding.embeddings,
                            model=embedding.model,
                            dim=embedding.dim,
                        )
                        result = PreviewResult(
                            status="ready",
                            output={
                                "version": 1,
                                "embedded_chunks": count,
                                "model": embedding.model,
                                "dim": embedding.dim,
                            },
                        )
                repo.mark_stage(
                    conn,
                    file_id=claimed.file.id,
                    stage=claimed.task.stage,
                    status=result.status,
                    storage_key=result.storage_key,
                    output=result.output,
                    error_code=result.error_code,
                    error_message=result.error_message,
                )
                repo.ack(conn, claimed.message_id)
                logging.info(
                    "completed task=%s file=%s stage=%s status=%s",
                    claimed.task.id,
                    claimed.file.id,
                    claimed.task.stage,
                    result.status,
                )
            except Exception as exc:
                logging.exception(
                    "failed task=%s file=%s stage=%s",
                    claimed.task.id,
                    claimed.file.id,
                    claimed.task.stage,
                )
                if claimed.task.attempts >= claimed.task.max_attempts:
                    repo.mark_stage(
                        conn,
                        file_id=claimed.file.id,
                        stage=claimed.task.stage,
                        status="failed",
                        error_code=exc.__class__.__name__,
                        error_message=str(exc)[:2000],
                    )
                    repo.ack(conn, claimed.message_id)
                else:
                    repo.mark_retry(
                        conn,
                        claimed=claimed,
                        error_code=exc.__class__.__name__,
                        error_message=str(exc)[:2000],
                        payload=message.payload,
                    )
                    repo.ack(conn, claimed.message_id)

    return processed_any


def main() -> None:
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
    settings = load_settings()
    repo = Repository(settings)
    storage = ObjectStorage(settings)
    embedding_client = EmbeddingClient(settings)
    embedding_server = start_embedding_http_server(settings, embedding_client)
    processor = TaskProcessor(
        preview_processor=PreviewProcessor(settings, storage),
        parse_processor=ParseProcessor(settings, storage),
    )

    stop_signal = StopSignal()
    signal.signal(signal.SIGTERM, stop_signal.handle)
    signal.signal(signal.SIGINT, stop_signal.handle)

    logging.info("file worker started worker_id=%s", settings.worker_id)
    try:
        while not stop_signal.stop:
            processed = run_once(repo, processor, embedding_client)
            if not processed:
                time.sleep(settings.poll_interval_seconds)
    finally:
        embedding_server.shutdown()
    logging.info("file worker stopped")


if __name__ == "__main__":
    main()
