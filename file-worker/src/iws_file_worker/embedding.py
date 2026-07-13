from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from typing import Any

import requests

from .config import Settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmbeddingResult:
    embeddings: list[list[float]]
    model: str
    dim: int


class EmbeddingClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @property
    def enabled(self) -> bool:
        return bool(self.settings.embedding_api_key)

    def embed(self, texts: list[str], *, text_type: str) -> EmbeddingResult:
        if not self.enabled:
            raise RuntimeError("DASHSCOPE_API_KEY is not configured")
        clean_texts = [text.strip() for text in texts if text and text.strip()]
        if not clean_texts:
            return EmbeddingResult([], self.settings.embedding_model, self.settings.embedding_dim)

        embeddings: list[list[float]] = []
        for start in range(0, len(clean_texts), self.settings.embedding_batch_size):
            batch = clean_texts[start : start + self.settings.embedding_batch_size]
            embeddings.extend(self._embed_batch(batch, text_type=text_type))
        return EmbeddingResult(
            embeddings=embeddings,
            model=self.settings.embedding_model,
            dim=self.settings.embedding_dim,
        )

    def _embed_batch(self, texts: list[str], *, text_type: str) -> list[list[float]]:
        response = requests.post(
            self.settings.embedding_api_url,
            headers={
                "Authorization": f"Bearer {self.settings.embedding_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.settings.embedding_model,
                "input": {"texts": texts},
                "parameters": {
                    "text_type": text_type,
                    "output_type": "dense",
                    "dimension": self.settings.embedding_dim,
                },
            },
            timeout=(10, 120),
        )
        if response.status_code >= 400:
            raise RuntimeError(
                f"Embedding request failed: {response.status_code} {response.text[:1000]}"
            )
        payload = response.json()
        output = payload.get("output") if isinstance(payload, dict) else None
        rows = output.get("embeddings") if isinstance(output, dict) else None
        if not isinstance(rows, list):
            raise RuntimeError("Embedding response missing output.embeddings")

        vectors: list[list[float]] = []
        for row in rows:
            vector = row.get("embedding") if isinstance(row, dict) else None
            if not isinstance(vector, list):
                raise RuntimeError("Embedding response row missing embedding")
            if len(vector) != self.settings.embedding_dim:
                raise RuntimeError(
                    f"Embedding dim mismatch: expected {self.settings.embedding_dim}, got {len(vector)}"
                )
            vectors.append([float(v) for v in vector])
        return vectors


def start_embedding_http_server(settings: Settings, client: EmbeddingClient) -> ThreadingHTTPServer:
    class Handler(BaseHTTPRequestHandler):
        server_version = "IwsEmbeddingService/0.1"

        def log_message(self, fmt: str, *args: Any) -> None:
            logger.info("embedding http - " + fmt, *args)

        def _send_json(self, status: int, data: dict[str, Any]) -> None:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:
            if self.path == "/health":
                self._send_json(200, {"ok": True, "embeddingEnabled": client.enabled})
                return
            self._send_json(404, {"error": "not_found"})

        def do_POST(self) -> None:
            if self.path != "/embed":
                self._send_json(404, {"error": "not_found"})
                return
            if settings.embedding_service_token:
                auth = self.headers.get("Authorization", "")
                if auth != f"Bearer {settings.embedding_service_token}":
                    self._send_json(401, {"error": "unauthorized"})
                    return
            try:
                length = int(self.headers.get("Content-Length") or "0")
                raw = self.rfile.read(length)
                payload = json.loads(raw.decode("utf-8")) if raw else {}
                texts = payload.get("texts")
                if not isinstance(texts, list) or not all(isinstance(t, str) for t in texts):
                    self._send_json(400, {"error": "texts must be string[]"})
                    return
                text_type = payload.get("text_type") or "query"
                if text_type not in {"query", "document"}:
                    self._send_json(400, {"error": "text_type must be query or document"})
                    return
                result = client.embed(texts, text_type=text_type)
                self._send_json(
                    200,
                    {
                        "model": result.model,
                        "dim": result.dim,
                        "embeddings": result.embeddings,
                    },
                )
            except Exception as exc:
                logger.exception("embedding http request failed")
                self._send_json(500, {"error": exc.__class__.__name__, "message": str(exc)})

    server = ThreadingHTTPServer(
        (settings.embedding_service_host, settings.embedding_service_port),
        Handler,
    )
    thread = Thread(target=server.serve_forever, name="embedding-http", daemon=True)
    thread.start()
    logger.info(
        "embedding http server started host=%s port=%s enabled=%s",
        settings.embedding_service_host,
        settings.embedding_service_port,
        client.enabled,
    )
    return server
