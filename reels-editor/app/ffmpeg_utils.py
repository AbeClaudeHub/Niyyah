"""Thin helpers around ffmpeg / ffprobe invoked via subprocess.

We deliberately call the binaries directly (no wrapper library) so the exact
filter strings stay visible and debuggable.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


class FFmpegError(RuntimeError):
    """Raised when ffmpeg/ffprobe exits non-zero. Carries the tail of stderr."""


def run(cmd: list[str], *, cwd: Path | None = None, capture_stderr: bool = True) -> str:
    """Run a command, returning combined stderr text.

    ffmpeg writes its progress/log to stderr, so for parsing (e.g. silencedetect)
    we capture stderr. Raises FFmpegError with the stderr tail on failure.
    """
    proc = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=str(cwd) if cwd else None,
    )
    stderr = proc.stderr or ""
    if proc.returncode != 0:
        tail = "\n".join(stderr.strip().splitlines()[-20:])
        raise FFmpegError(f"command failed ({proc.returncode}): {' '.join(cmd[:3])} ...\n{tail}")
    return stderr if capture_stderr else (proc.stdout or "")


def ffprobe(path: Path) -> dict:
    """Return parsed ffprobe JSON for a media file."""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        str(path),
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        raise FFmpegError(f"ffprobe failed: {proc.stderr.strip()[-500:]}")
    return json.loads(proc.stdout or "{}")


def get_duration(path: Path) -> float:
    """Duration in seconds (0.0 if unknown)."""
    info = ffprobe(path)
    try:
        return float(info["format"]["duration"])
    except (KeyError, ValueError, TypeError):
        # Fall back to the longest stream duration we can find.
        best = 0.0
        for s in info.get("streams", []):
            try:
                best = max(best, float(s.get("duration", 0)))
            except (ValueError, TypeError):
                continue
        return best


def get_video_dimensions(path: Path) -> tuple[int, int]:
    """Return (width, height) of the first video stream, accounting for rotation."""
    info = ffprobe(path)
    for s in info.get("streams", []):
        if s.get("codec_type") == "video":
            w = int(s.get("width", 0))
            h = int(s.get("height", 0))
            # Account for rotation metadata so orientation logic is correct.
            rotation = 0
            if "tags" in s and "rotate" in s["tags"]:
                try:
                    rotation = abs(int(s["tags"]["rotate"]))
                except (ValueError, TypeError):
                    rotation = 0
            for sd in s.get("side_data_list", []):
                if "rotation" in sd:
                    try:
                        rotation = abs(int(sd["rotation"]))
                    except (ValueError, TypeError):
                        pass
            if rotation in (90, 270):
                w, h = h, w
            return w, h
    raise FFmpegError("no video stream found")


def has_audio(path: Path) -> bool:
    info = ffprobe(path)
    return any(s.get("codec_type") == "audio" for s in info.get("streams", []))
