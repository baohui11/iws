from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any

import requests

from .config import Settings

LOGGER = logging.getLogger(__name__)

PADDLEOCR_SUPPORTED_EXTENSIONS = {"pdf", "jpeg", "jpg", "png", "tiff", "tif", "bmp"}
PADDLEOCR_MIME_TYPES = {
    "pdf": "application/pdf",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "png": "image/png",
    "tiff": "image/tiff",
    "tif": "image/tiff",
    "bmp": "image/bmp",
}


@dataclass(frozen=True)
class OcrPage:
    page_no: int
    text: str
    raw: dict[str, Any]


class PaddleOcrClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def parse(self, data: bytes, file_ext: str) -> list[OcrPage]:
        ext = file_ext.strip().lower().lstrip(".")
        if ext not in PADDLEOCR_SUPPORTED_EXTENSIONS:
            raise RuntimeError(f"PaddleOCR unsupported extension: {ext}")
        if not self.settings.paddleocr_token:
            raise RuntimeError("PADDLEOCR_TOKEN is not configured")

        job_url = self.settings.paddleocr_job_url.rstrip("/")
        job_id = self._submit_job(job_url, data, ext)
        json_url = self._wait_for_json_url(job_url, job_id)
        jsonl_text = self._download_jsonl(json_url)
        return extract_pages_from_jsonl(jsonl_text)

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"bearer {self.settings.paddleocr_token}"}

    def _submit_job(self, job_url: str, data: bytes, ext: str) -> str:
        payload = {
            "model": self.settings.paddleocr_model,
            "optionalPayload": json.dumps(
                {
                    "useDocOrientationClassify": False,
                    "useDocUnwarping": False,
                    "useChartRecognition": False,
                }
            ),
        }
        files = {"file": (f"document.{ext}", data, PADDLEOCR_MIME_TYPES[ext])}
        response = requests.post(
            job_url,
            headers=self._headers(),
            data=payload,
            files=files,
            timeout=120,
        )
        response.raise_for_status()
        body = response.json()
        try:
            job_id = body["data"]["jobId"]
        except (KeyError, TypeError) as exc:
            raise RuntimeError(f"PaddleOCR submit response missing jobId: {body}") from exc
        LOGGER.info("PaddleOCR job submitted job_id=%s", job_id)
        return str(job_id)

    def _wait_for_json_url(self, job_url: str, job_id: str) -> str:
        deadline = time.monotonic() + self.settings.paddleocr_max_wait_seconds
        consecutive_errors = 0
        while True:
            if time.monotonic() > deadline:
                raise RuntimeError(f"PaddleOCR job timeout: {job_id}")
            try:
                response = requests.get(
                    f"{job_url}/{job_id}",
                    headers=self._headers(),
                    timeout=30,
                )
                response.raise_for_status()
                data = response.json().get("data") or {}
                state = str(data.get("state") or "").lower()
                if state == "done":
                    json_url = (data.get("resultUrl") or {}).get("jsonUrl")
                    if not json_url:
                        raise RuntimeError(f"PaddleOCR jsonUrl missing: {data}")
                    return str(json_url)
                if state == "failed":
                    raise RuntimeError(
                        f"PaddleOCR job failed: {data.get('errorMsg') or 'unknown'}"
                    )
                consecutive_errors = 0
            except RuntimeError:
                raise
            except Exception as exc:
                consecutive_errors += 1
                if consecutive_errors >= 5:
                    raise RuntimeError("PaddleOCR polling failed too many times") from exc
                LOGGER.warning("PaddleOCR polling error: %s", exc)
            time.sleep(self.settings.paddleocr_poll_interval_seconds)

    def _download_jsonl(self, json_url: str) -> str:
        response = requests.get(json_url, timeout=120)
        response.raise_for_status()
        return response.text


def extract_pages_from_jsonl(jsonl_text: str) -> list[OcrPage]:
    pages: list[OcrPage] = []
    page_no = 0
    for line_no, raw_line in enumerate(jsonl_text.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Invalid PaddleOCR JSONL line {line_no}: {exc}") from exc
        result = payload.get("result") or {}
        layouts = result.get("layoutParsingResults") or []
        for layout in layouts:
            markdown = layout.get("markdown") or {}
            text = str(markdown.get("text") or "").strip()
            if not text:
                continue
            page_no += 1
            pages.append(OcrPage(page_no=page_no, text=text, raw=layout))
    if not pages:
        raise RuntimeError("PaddleOCR returned no text pages")
    return pages
