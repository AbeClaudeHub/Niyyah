"""FastAPI app: upload -> background process -> poll -> download.

Serves the static single-page frontend and exposes a tiny JSON API.
"""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config, jobs
from .ffmpeg_utils import FFmpegError, get_duration
from .pipeline.run import process_video

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
async def create_job(background: BackgroundTasks, file: UploadFile = File(...)) -> JSONResponse:
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
    background.add_task(process_video, job_id, input_path)
    return JSONResponse({"job_id": job_id}, status_code=202)


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
