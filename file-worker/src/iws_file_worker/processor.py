from __future__ import annotations

from .models import ClaimedTask
from .parse import ParseProcessor, ParseResult
from .preview import PreviewProcessor, PreviewResult


class TaskProcessor:
    def __init__(
        self,
        *,
        preview_processor: PreviewProcessor,
        parse_processor: ParseProcessor,
    ) -> None:
        self.preview_processor = preview_processor
        self.parse_processor = parse_processor

    def process(self, claimed: ClaimedTask) -> PreviewResult | ParseResult:
        stage = claimed.task.stage
        if stage == "preview":
            return self.preview_processor.process(claimed.file)
        if stage == "parse":
            return self.parse_processor.process(claimed.file)
        if stage == "index":
            return PreviewResult(status="ready", output={"version": 1})
        if stage == "embed":
            return PreviewResult(
                status="skipped",
                output={"version": 1, "reason": "embed_not_implemented_yet"},
            )
        return PreviewResult(
            status="failed",
            error_code="UNSUPPORTED_STAGE",
            error_message=f"Unsupported stage: {stage}",
        )
