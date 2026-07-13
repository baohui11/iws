# file-worker

Background worker for project file processing.

## Source layout

The path `src/iws_file_worker/` is intentional. This is the standard Python
`src` layout:

- `src/` keeps importable package code separate from project metadata and tests.
- `iws_file_worker/` is the actual Python package name used by imports and the
  console script `iws-file-worker`.

Removing the inner package directory would make packaging/imports less standard
and would require changing `pyproject.toml`, Docker entrypoints, and imports.

Planned stages:

- `preview`: generate user-facing preview artifacts.
  - Office documents: call Gotenberg and upload `preview.pdf`.
  - Spreadsheet/CSV files: create bounded `preview.json`.
  - Native PDF/images/media/text: mark as ready or skipped as appropriate.
- `parse`: extract text/OCR output and write `file_documents` / `file_chunks`.
- `index`: update PostgreSQL full-text `search_vector` for parsed chunks.
- `embed`: generate dense vectors for parsed chunks through DashScope
  `text-embedding-v4` and write `file_chunks.embedding`.

The web app owns business state in `files` and `file_process_tasks`. The worker
should claim tasks from PostgreSQL/pgmq, update task status, and write artifacts
back to object storage.

Queue contract:

- Queue name: `file_processing`
- Message payload:

```json
{
  "version": 1,
  "taskId": "uuid",
  "fileId": "uuid",
  "stage": "preview"
}
```

Workers must treat `file_process_tasks` as the source of truth. A pgmq message is
only a delivery signal, so duplicated messages should be ignored when the task is
already `processing`, `ready`, `failed`, or `skipped`.

Current implementation:

- `preview`
  - `doc/docx/ppt/pptx`: convert to PDF through Gotenberg.
  - `xls/xlsx`: create bounded spreadsheet preview JSON.
  - `csv/tsv`: create bounded spreadsheet preview JSON.
  - Directly previewable files such as PDF, images, text, audio, and video are
    marked `skipped` because the web app can preview the source object.
- `parse`
  - `docx`: extract paragraphs and tables directly.
  - `xlsx`: extract rows by sheet and row window.
  - `csv/tsv`: extract rows by row window.
  - `txt/md`: extract text directly.
  - `pdf`: extract text first; if text density is too low, fall back to PaddleOCR.
  - `ppt/pptx`: reuse the preview PDF in `files.preview_storage_key`, then process
    through PaddleOCR. If the preview PDF is missing, convert once through Gotenberg
    as a fallback.
  - `doc/xls`: reuse preview PDF when available, then parse as PDF.
- `index`: updates `file_chunks.search_vector`.
- `embed`: reads parsed chunks, calls DashScope `text-embedding-v4`, and writes
  `file_chunks.embedding`.

PaddleOCR configuration:

```env
PADDLEOCR_TOKEN=
PADDLEOCR_JOB_URL=https://paddleocr.aistudio-app.com/api/v2/ocr/jobs
PADDLEOCR_MODEL=PaddleOCR-VL-1.6
PADDLEOCR_POLL_INTERVAL_SECONDS=5
PADDLEOCR_MAX_WAIT_SECONDS=1800
```

Embedding configuration:

```env
DASHSCOPE_API_KEY=
EMBEDDING_MODEL=text-embedding-v4
EMBEDDING_DIM=1536
EMBEDDING_BATCH_SIZE=10
EMBEDDING_SERVICE_HOST=0.0.0.0
EMBEDDING_SERVICE_PORT=8010
EMBEDDING_SERVICE_TOKEN=
```

The worker also starts an internal HTTP endpoint:

- `GET /health`
- `POST /embed` with `{ "texts": ["..."], "text_type": "query" | "document" }`

The web app can call this service through `EMBEDDING_SERVICE_URL` to generate
query vectors without knowing model-specific details.

Local run:

```powershell
cd E:\app\iws\file-worker
python -m venv .venv
.\.venv\Scripts\pip install -e .
.\.venv\Scripts\python -m iws_file_worker
```

Docker run:

```powershell
cd E:\app\iws\docker
docker compose up -d --build file-worker
```

`file-worker` depends on PostgreSQL, MinIO and Gotenberg. For OCR parsing, set
`PADDLEOCR_TOKEN` in `docker/.env` before starting the service.
