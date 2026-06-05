"""Step 0 - Normalize the raw upload to a known format.

Forces a constant frame rate, stereo 48k audio, bakes in rotation metadata, and
re-encodes to H.264. This removes the bulk of phone-upload weirdness (VFR,
sideways iPhone clips, exotic codecs) before any further processing.

If the source has no audio track we synthesize a silent one so downstream
filters (silencedetect, aselect) always have something to work with.
"""

from __future__ import annotations

from pathlib import Path

from .. import config
from ..ffmpeg_utils import has_audio, run


def normalize(src: Path, dst: Path) -> None:
    audio_present = has_audio(src)

    cmd = ["ffmpeg", "-y"]
    if not audio_present:
        # Generate a silent stereo track matched to the video length (-shortest).
        cmd += ["-f", "lavfi", "-i", f"anullsrc=channel_layout=stereo:sample_rate={config.AUDIO_RATE}"]
        cmd += ["-i", str(src)]
        cmd += ["-shortest", "-map", "1:v:0", "-map", "0:a:0"]
    else:
        cmd += ["-i", str(src)]

    cmd += [
        "-vf", f"fps={config.FPS}",
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "veryfast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-ar", str(config.AUDIO_RATE),
        "-ac", str(config.AUDIO_CHANNELS),
        str(dst),
    ]
    run(cmd)
