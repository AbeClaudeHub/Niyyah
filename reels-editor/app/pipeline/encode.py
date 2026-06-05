"""Step 6 - Final single-pass encode.

Chains reframe -> hook zoom -> burn captions into one filtergraph so there is
exactly one re-encode after the silence cut, and outputs an Instagram-Reels-ready
H.264 / yuv420p / AAC file with +faststart.

We run ffmpeg with the job directory as the working dir so the subtitles filter
can reference the .ass file by plain name (avoids path-escaping headaches).
"""

from __future__ import annotations

from pathlib import Path

from .. import config
from ..ffmpeg_utils import run
from .reframe import hook_zoom_filter, reframe_filter


def final_encode(
    trimmed: Path,
    ass_filename: str,
    src_w: int,
    src_h: int,
    dst: Path,
    *,
    cwd: Path,
) -> None:
    # Hand libass a fonts dir if the user bundled one (e.g. Montserrat-Bold.ttf).
    subtitles = f"subtitles={ass_filename}"
    if config.FONTS_DIR.is_dir() and any(config.FONTS_DIR.iterdir()):
        subtitles += f":fontsdir={config.FONTS_DIR}"

    filters = [
        reframe_filter(src_w, src_h),
        hook_zoom_filter(),
        subtitles,
    ]
    vf = ",".join(filters)

    run([
        "ffmpeg", "-y",
        "-i", str(trimmed),
        "-vf", vf,
        "-r", str(config.FPS),
        "-c:v", "libx264",
        "-profile:v", "high",
        "-level", "4.1",
        "-pix_fmt", "yuv420p",
        "-crf", str(config.VIDEO_CRF),
        "-preset", config.VIDEO_PRESET,
        "-c:a", "aac",
        "-b:a", config.AUDIO_BITRATE,
        "-ar", str(config.AUDIO_RATE),
        "-ac", str(config.AUDIO_CHANNELS),
        "-movflags", "+faststart",
        str(dst),
    ], cwd=cwd)
