"""In-memory job registry mirrored to status.json on disk.

Designed for a single-user / single-worker deployment. The processing function
(`pipeline.run.process_video`) is pure with respect to a job_id, so this can be
swapped for Redis+RQ later without touching the pipeline.
"""

from __future__ import annotations

import json
import threading
import time
from pathlib import Path

from . import config

# job_id -> dict
_JOBS: dict[str, dict] = {}
_LOCK = threading.Lock()

OUTPUT_NAME = "reels_final.mp4"
STATUS_NAME = "status.json"


def job_dir(job_id: str) -> Path:
    return config.STORAGE_DIR / job_id


def result_path(job_id: str) -> Path:
    return job_dir(job_id) / OUTPUT_NAME


def _persist(job: dict) -> None:
    d = job_dir(job["id"])
    d.mkdir(parents=True, exist_ok=True)
    (d / STATUS_NAME).write_text(json.dumps(job, indent=2), encoding="utf-8")


def create(job_id: str, original_filename: str) -> dict:
    job = {
        "id": job_id,
        "status": "queued",
        "stage": "Queued",
        "progress": 0,
        "error": None,
        "original_filename": original_filename,
        "created_at": time.time(),
        "info": {},
    }
    with _LOCK:
        _JOBS[job_id] = job
    _persist(job)
    return job


def update(job_id: str, **fields) -> None:
    with _LOCK:
        job = _JOBS.get(job_id)
        if job is None:
            return
        job.update(fields)
        snapshot = dict(job)
    _persist(snapshot)


def get(job_id: str) -> dict | None:
    with _LOCK:
        job = _JOBS.get(job_id)
        if job is not None:
            return dict(job)
    # Fall back to disk (e.g. after a process restart).
    status_file = job_dir(job_id) / STATUS_NAME
    if status_file.exists():
        try:
            return json.loads(status_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
    return None


def mark_stale_processing() -> None:
    """On startup, any job left mid-flight can never resume -> mark it failed."""
    if not config.STORAGE_DIR.exists():
        return
    for d in config.STORAGE_DIR.iterdir():
        status_file = d / STATUS_NAME
        if not status_file.exists():
            continue
        try:
            job = json.loads(status_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if job.get("status") in ("queued", "processing"):
            job["status"] = "error"
            job["error"] = "Interrupted by a server restart. Please re-upload."
            try:
                status_file.write_text(json.dumps(job, indent=2), encoding="utf-8")
            except OSError:
                pass


def cleanup_old() -> int:
    """Delete job directories older than the TTL. Returns count removed."""
    if not config.STORAGE_DIR.exists():
        return 0
    cutoff = time.time() - config.JOB_TTL_HOURS * 3600
    removed = 0
    for d in config.STORAGE_DIR.iterdir():
        if not d.is_dir():
            continue
        try:
            if d.stat().st_mtime < cutoff:
                _rmtree(d)
                with _LOCK:
                    _JOBS.pop(d.name, None)
                removed += 1
        except OSError:
            continue
    return removed


def _rmtree(path: Path) -> None:
    for child in path.iterdir():
        if child.is_dir():
            _rmtree(child)
        else:
            child.unlink(missing_ok=True)
    path.rmdir()
