"""Render a short style preview without transcription.

Used by the web UI's "Preview style" button so the user can tune caption colours,
font, position and words-per-line quickly. Uses a fixed sample sentence (with
sacred terms) over a generated on-brand background, so it renders in a few
seconds and never touches Whisper.
"""

from __future__ import annotations

import time
import uuid
from pathlib import Path

from .. import config
from ..ffmpeg_utils import run
from . import captions, islamic

SAMPLE_SENTENCE = (
    "never give up just trust allah and say inshallah "
    "the prophet muhammad showed us real sabr"
)

_PREVIEW_DIRNAME = "_preview"
_WORD_DUR = 0.34
_WORD_GAP = 0.40


def _sample_words() -> list[dict]:
    words: list[dict] = []
    t = 0.35
    for w in SAMPLE_SENTENCE.split():
        words.append({"word": w, "start": round(t, 2), "end": round(t + _WORD_DUR, 2)})
        t += _WORD_GAP
    return words


def _prune(preview_dir: Path, max_age_s: int = 1800) -> None:
    """Delete preview files older than ~30 min so they don't accumulate."""
    cutoff = time.time() - max_age_s
    for f in preview_dir.glob("*.mp4"):
        try:
            if f.stat().st_mtime < cutoff:
                f.unlink(missing_ok=True)
        except OSError:
            continue


def render_preview(style: dict) -> Path:
    """Render a sample reel with the given (resolved) style. Returns the mp4 path."""
    preview_dir = config.STORAGE_DIR / _PREVIEW_DIRNAME
    preview_dir.mkdir(parents=True, exist_ok=True)
    _prune(preview_dir)

    token = uuid.uuid4().hex[:10]
    ass_name = f"{token}.ass"
    ass_path = preview_dir / ass_name
    out = preview_dir / f"{token}.mp4"

    words = islamic.transform(_sample_words(), style.get("append_pbuh"))
    captions.build_ass(words, ass_path, style)

    dur = round(words[-1]["end"] + 0.6, 2)
    bg = (
        f"gradients=s={config.OUT_WIDTH}x{config.OUT_HEIGHT}"
        f":c0=0x0b231a:c1=0x0a0a10:x0=0:y0=0:x1={config.OUT_WIDTH}:y1={config.OUT_HEIGHT}"
        f":d={dur}:r={config.FPS}"
    )
    subtitles = f"subtitles={ass_name}"
    if config.FONTS_DIR.is_dir() and any(config.FONTS_DIR.iterdir()):
        subtitles += f":fontsdir={config.FONTS_DIR}"

    run([
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", bg,
        "-vf", subtitles,
        "-t", str(dur),
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-preset", "ultrafast",
        "-movflags", "+faststart",
        str(out),
    ], cwd=preview_dir)

    ass_path.unlink(missing_ok=True)
    return out
