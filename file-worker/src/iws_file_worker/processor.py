from __future__ import annotations

from .models import ClaimedTask
from .preview import PreviewProcessor, PreviewResult


class TaskProcessor:
    def __init__(self, preview_processor: PreviewProcessor) -> None:
        self.preview_processor = preview_processor

    def process(self, claimed: ClaimedTask) -> PreviewResult:
        stage = claimed.task.stage
        if stage == "preview":
            return self.preview_processor.process(claimed.file)
        if stage == "parse":
            return PreviewResult(
                status="skipped",
                output={"version": 1, "reason": "parse_not_implemented_yet"},
            )
        if stage == "index":
            return PreviewResult(
                status="skipped",
                output={"version": 1, "reason": "index_not_implemented_yet"},
            )
        return PreviewResult(
            status="failed",
            error_code="UNSUPPORTED_STAGE",
            error_message=f"Unsupported stage: {stage}",
        )
