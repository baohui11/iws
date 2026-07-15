from __future__ import annotations

import logging
import signal
import time
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from types import FrameType

from .config import load_settings
from .embedding import EmbeddingClient, start_embedding_http_server
from .models import FileProcessStage, QueueMessage
from .parse import ParseProcessor
from .processor import TaskProcessor
from .repository import Repository
from .storage import ObjectStorage
from .preview import PreviewProcessor, PreviewResult

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s - %(message)s"
RECONCILE_INTERVAL_SECONDS = 60


class StopSignal:
    def __init__(self) -> None:
        self.stop = False

    def handle(self, _signum: int, _frame: FrameType | None) -> None:
        self.stop = True


class StageExecutors:
    def __init__(self, settings) -> None:
        self._executors: dict[FileProcessStage, ThreadPoolExecutor] = {
            "preview": ThreadPoolExecutor(
                max_workers=settings.preview_concurrency,
                thread_name_prefix="file-preview",
            ),
            "parse": ThreadPoolExecutor(
                max_workers=settings.parse_concurrency,
                thread_name_prefix="file-parse",
            ),
            "index": ThreadPoolExecutor(
                max_workers=settings.index_concurrency,
                thread_name_prefix="file-index",
            ),
            "embed": ThreadPoolExecutor(
                max_workers=settings.embed_concurrency,
                thread_name_prefix="file-embed",
            ),
        }

    def submit(self, message: QueueMessage, fn) -> Future:
        stage = message.payload.get("stage")
        executor = self._executors.get(stage, self._executors["preview"])
        return executor.submit(fn, message)

    def shutdown(self) -> None:
        for executor in self._executors.values():
            executor.shutdown(wait=True, cancel_futures=False)


def process_message(
    repo: Repository,
    processor: TaskProcessor,
    embedding_client: EmbeddingClient,
    message: QueueMessage,
) -> None:
    with repo.connect() as conn:
        claimed = repo.claim_message(conn, message)
        if not claimed:
            return

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


def run_once(
    repo: Repository,
    processor: TaskProcessor,
    embedding_client: EmbeddingClient,
    executors: StageExecutors,
) -> bool:
    with repo.connect() as conn:
        messages = repo.read_messages(conn)
    if not messages:
        return False

    futures = [
        executors.submit(
            message,
            lambda msg: process_message(repo, processor, embedding_client, msg),
        )
        for message in messages
    ]
    for future in as_completed(futures):
        future.result()
    return True


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
    executors = StageExecutors(settings)

    stop_signal = StopSignal()
    signal.signal(signal.SIGTERM, stop_signal.handle)
    signal.signal(signal.SIGINT, stop_signal.handle)

    logging.info(
        "file worker started worker_id=%s max_messages=%s concurrency=%s/%s/%s/%s",
        settings.worker_id,
        settings.max_messages,
        settings.preview_concurrency,
        settings.parse_concurrency,
        settings.index_concurrency,
        settings.embed_concurrency,
    )
    try:
        last_reconcile = 0.0
        while not stop_signal.stop:
            if time.monotonic() - last_reconcile >= RECONCILE_INTERVAL_SECONDS:
                with repo.connect() as conn:
                    recovered = repo.reconcile_pending_tasks(conn)
                if recovered:
                    logging.warning("re-published stale file processing tasks count=%s", recovered)
                last_reconcile = time.monotonic()
            processed = run_once(repo, processor, embedding_client, executors)
            if not processed:
                time.sleep(settings.poll_interval_seconds)
    finally:
        executors.shutdown()
        embedding_server.shutdown()
    logging.info("file worker stopped")


if __name__ == "__main__":
    main()
