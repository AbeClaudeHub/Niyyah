"""FastAPI app: upload -> background process -> poll -> download.

Serves the static single-page frontend and exposes a tiny JSON API.
"""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config, jobs, style as style_mod
from .ffmpeg_utils import FFmpegError, get_duration
from .pipeline.preview import render_preview
from .pipeline.run import process_video

# Caption-style fields the UI may send (all optional; validated by style.resolve).
_STYLE_FIELDS = (
    "font", "font_size", "words_per_line", "highlight_color", "sacred_color",
    "base_color", "margin_v", "alignment", "pop", "append_pbuh",
)

app = FastAPI(title="One-Click Reels Editor")

_CHUNK = 1024 * 1024  # 1 MB streaming chunks


@app.on_event("startup")
def _startup() -> None:
    config.ensure_dirs()
    jobs.mark_stale_processing()
    jobs.cleanup_old()


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.post("/api/jobs")
async def create_job(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    font: str | None = Form(None),
    font_size: str | None = Form(None),
    words_per_line: str | None = Form(None),
    highlight_color: str | None = Form(None),
    sacred_color: str | None = Form(None),
    base_color: str | None = Form(None),
    margin_v: str | None = Form(None),
    alignment: str | None = Form(None),
    pop: str | None = Form(None),
    append_pbuh: str | None = Form(None),
) -> JSONResponse:
    args = locals()
    overrides = {f: args[f] for f in _STYLE_FIELDS}
    style = style_mod.resolve(overrides)

    ext = Path(file.filename or "").suffix.lower()
    if ext not in config.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext or '?'}'. Allowed: "
            + ", ".join(sorted(config.ALLOWED_EXTENSIONS)),
        )

    job_id = uuid.uuid4().hex[:12]
    d = jobs.job_dir(job_id)
    d.mkdir(parents=True, exist_ok=True)
    input_path = d / f"input{ext}"

    # Stream to disk, enforcing the size cap as we go.
    written = 0
    try:
        with input_path.open("wb") as out:
            while True:
                chunk = await file.read(_CHUNK)
                if not chunk:
                    break
                written += len(chunk)
                if written > config.MAX_UPLOAD_BYTES:
                    out.close()
                    input_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Max {config.MAX_UPLOAD_BYTES // (1024*1024)} MB.",
                    )
                out.write(chunk)
    finally:
        await file.close()

    if written == 0:
        input_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Empty upload.")

    # Validate duration before committing to a (slow) job.
    try:
        duration = get_duration(input_path)
    except FFmpegError:
        input_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Could not read that video file.")

    if duration > config.MAX_SOURCE_SECONDS:
        input_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail=f"Video is {int(duration)}s; max is {config.MAX_SOURCE_SECONDS}s. "
            "Please upload a shorter clip.",
        )

    jobs.create(job_id, original_filename=file.filename or f"input{ext}")
    background.add_task(process_video, job_id, input_path, style)
    return JSONResponse({"job_id": job_id}, status_code=202)


@app.post("/api/preview")
def style_preview(overrides: dict | None = None):
    """Render a short sample reel with the given caption style (no transcription)."""
    style = style_mod.resolve(overrides or {})
    try:
        path = render_preview(style)
    except FFmpegError as exc:
        raise HTTPException(status_code=500, detail=f"Preview render failed: {exc}")
    return FileResponse(path, media_type="video/mp4", filename="preview.mp4")


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str) -> dict:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


@app.get("/api/jobs/{job_id}/result")
def job_result(job_id: str):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.get("status") != "done":
        raise HTTPException(status_code=409, detail="Job not finished yet.")
    path = jobs.result_path(job_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Result file missing.")
    return FileResponse(
        path,
        media_type="video/mp4",
        filename="reel.mp4",
    )


# Static frontend (mounted last so /api/* takes precedence).
app.mount("/", StaticFiles(directory=str(config.STATIC_DIR), html=True), name="static")
