"""Orchestrates the full pipeline for one job, updating progress as it goes.

Critical ordering (see plan): time-axis edits (silence cut) happen BEFORE
transcription; spatial edits (reframe, zoom, captions) happen after, so caption
timestamps land on the final timeline with zero remapping.

Jobs are serialized with a process-wide lock so two heavy runs never contend for
RAM/CPU on a small instance.
"""

from __future__ import annotations

import threading
from pathlib import Path

from .. import config, jobs
from ..ffmpeg_utils import get_video_dimensions
from . import captions, encode, normalize, silence, transcribe

_PROCESS_LOCK = threading.Lock()


def process_video(job_id: str, input_path: Path) -> None:
    d = jobs.job_dir(job_id)
    norm = d / "norm.mp4"
    trimmed = d / "trimmed.mp4"
    ass_name = "captions.ass"
    ass_path = d / ass_name
    out = jobs.result_path(job_id)

    with _PROCESS_LOCK:
        try:
            jobs.update(job_id, status="processing", stage="Normalizing video", progress=10)
            normalize.normalize(input_path, norm)

            jobs.update(job_id, stage="Cutting dead air", progress=25)
            cut_info = silence.cut_silences(norm, trimmed)
            jobs.update(job_id, info=cut_info)

            jobs.update(job_id, stage="Transcribing speech", progress=45)
            words = transcribe.transcribe(trimmed)

            jobs.update(job_id, stage="Styling captions", progress=70)
            captions.build_ass(words, ass_path)

            jobs.update(job_id, stage="Reframing & rendering", progress=80)
            src_w, src_h = get_video_dimensions(trimmed)
            encode.final_encode(trimmed, ass_name, src_w, src_h, out, cwd=d)

            # Free disk: intermediates are no longer needed once the result exists.
            for tmp in (norm, trimmed):
                tmp.unlink(missing_ok=True)

            info = dict(cut_info)
            info["word_count"] = len(words)
            jobs.update(
                job_id,
                status="done",
                stage="Done",
                progress=100,
                info=info,
            )
        except Exception as exc:  # noqa: BLE001 - surface any failure to the user
            jobs.update(
                job_id,
                status="error",
                stage="Failed",
                error=str(exc),
            )
