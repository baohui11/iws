# file-worker

Background worker for project file processing.

Planned stages:

- `preview`: generate user-facing preview artifacts.
  - Office documents: call Gotenberg and upload `preview.pdf`.
  - Spreadsheet/CSV files: create bounded `preview.json`.
  - Native PDF/images/media/text: mark as ready or skipped as appropriate.
- `parse`: extract text/Markdown and OCR output for search/RAG.
- `index`: chunk parsed content, create embeddings, and update vector/full-text indexes.

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
- `parse`: marked `skipped` for now.
- `index`: marked `skipped` for now.

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
docker compose --profile file-processing up -d --build gotenberg file-worker
```
