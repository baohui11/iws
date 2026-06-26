from __future__ import annotations

import logging
import signal
import time
from types import FrameType

from .config import load_settings
from .processor import TaskProcessor
from .repository import Repository
from .storage import ObjectStorage
from .preview import PreviewProcessor

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s - %(message)s"


class StopSignal:
    def __init__(self) -> None:
        self.stop = False

    def handle(self, _signum: int, _frame: FrameType | None) -> None:
        self.stop = True


def run_once(repo: Repository, processor: TaskProcessor) -> bool:
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
    processor = TaskProcessor(PreviewProcessor(settings, storage))

    stop_signal = StopSignal()
    signal.signal(signal.SIGTERM, stop_signal.handle)
    signal.signal(signal.SIGINT, stop_signal.handle)

    logging.info("file worker started worker_id=%s", settings.worker_id)
    while not stop_signal.stop:
        processed = run_once(repo, processor)
        if not processed:
            time.sleep(settings.poll_interval_seconds)
    logging.info("file worker stopped")


if __name__ == "__main__":
    main()
