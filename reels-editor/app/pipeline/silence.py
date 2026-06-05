"""Step 1 - Detect and cut silent gaps (dead air) for tight, jump-cut pacing.

Approach:
  1. Run ffmpeg `silencedetect` and parse silence_start / silence_end from stderr.
  2. Compute the complementary "keep" segments, padded slightly so we don't clip
     word onsets / breaths (which is what makes auto-cut audio sound robotic).
  3. Re-stamp the kept frames into a continuous timeline in a single ffmpeg pass
     using select/aselect + setpts/asetpts (frame-accurate, no concat drift).

This MUST run before transcription so caption timestamps land on the final,
already-shortened timeline.
"""

from __future__ import annotations

import re
from pathlib import Path

from .. import config
from ..ffmpeg_utils import get_duration, run

_START_RE = re.compile(r"silence_start:\s*(-?[\d.]+)")
_END_RE = re.compile(r"silence_end:\s*(-?[\d.]+)")


def _detect_silences(src: Path) -> list[tuple[float, float]]:
    """Return list of (start, end) silent intervals in seconds."""
    stderr = run([
        "ffmpeg", "-i", str(src),
        "-af", f"silencedetect=noise={config.SILENCE_NOISE_DB}:d={config.SILENCE_MIN_DUR}",
        "-f", "null", "-",
    ])
    silences: list[tuple[float, float]] = []
    pending_start: float | None = None
    for line in stderr.splitlines():
        m = _START_RE.search(line)
        if m:
            pending_start = max(0.0, float(m.group(1)))
            continue
        m = _END_RE.search(line)
        if m and pending_start is not None:
            silences.append((pending_start, float(m.group(1))))
            pending_start = None
    return silences


def _keep_segments(duration: float, silences: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Complement of the silent intervals -> the parts we keep, with padding."""
    keeps: list[tuple[float, float]] = []
    cursor = 0.0
    for s_start, s_end in silences:
        seg_start = cursor
        seg_end = s_start
        if seg_end - seg_start > 0.01:
            keeps.append((seg_start, seg_end))
        cursor = s_end
    if duration - cursor > 0.01:
        keeps.append((cursor, duration))

    # Apply padding and clamp to bounds, then merge any overlaps the padding caused.
    padded: list[tuple[float, float]] = []
    for start, end in keeps:
        start = max(0.0, start - config.KEEP_PADDING)
        end = min(duration, end + config.KEEP_PADDING)
        if padded and start <= padded[-1][1]:
            padded[-1] = (padded[-1][0], max(padded[-1][1], end))
        else:
            padded.append((start, end))
    return padded


def _between_expr(segments: list[tuple[float, float]]) -> str:
    parts = [f"between(t,{s:.3f},{e:.3f})" for s, e in segments]
    return "+".join(parts)


def cut_silences(src: Path, dst: Path) -> dict:
    """Cut dead air from `src` -> `dst`.

    Returns a small info dict: original duration, kept duration, segment count.
    If there is effectively nothing to cut, copies the timeline through unchanged
    (still via the filter pass so output format stays consistent).
    """
    duration = get_duration(src)
    silences = _detect_silences(src)
    keeps = _keep_segments(duration, silences)

    # Edge case: whole clip silent or detector returned nothing useful -> keep all.
    if not keeps:
        keeps = [(0.0, duration)]

    expr = _between_expr(keeps)
    run([
        "ffmpeg", "-y", "-i", str(src),
        "-vf", f"select='{expr}',setpts=N/FRAME_RATE/TB",
        "-af", f"aselect='{expr}',asetpts=N/SR/TB",
        "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", str(config.AUDIO_RATE), "-ac", str(config.AUDIO_CHANNELS),
        str(dst),
    ])

    kept_duration = sum(e - s for s, e in keeps)
    return {
        "original_duration": round(duration, 2),
        "kept_duration": round(kept_duration, 2),
        "removed_seconds": round(duration - kept_duration, 2),
        "segments": len(keeps),
        "cut_points": [round(s, 3) for s, _ in keeps[1:]],  # internal cut boundaries
    }
