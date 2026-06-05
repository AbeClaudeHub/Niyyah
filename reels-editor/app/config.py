"""Central configuration constants for the Reels editor.

Everything tunable lives here so the pipeline modules stay free of magic numbers.
Values can be overridden with environment variables for deployment.
"""

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent          # .../reels-editor
STORAGE_DIR = Path(os.environ.get("STORAGE_DIR", BASE_DIR / "storage"))
STATIC_DIR = BASE_DIR / "static"

# ---------------------------------------------------------------------------
# Output / Instagram Reels target spec
# ---------------------------------------------------------------------------
OUT_WIDTH = 1080
OUT_HEIGHT = 1920
FPS = 30
AUDIO_RATE = 48000
AUDIO_CHANNELS = 2
AUDIO_BITRATE = "128k"
VIDEO_CRF = 20          # final encode quality (lower = better, ~18-23 sensible)
VIDEO_PRESET = "medium"

# ---------------------------------------------------------------------------
# Transcription (faster-whisper)
# ---------------------------------------------------------------------------
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base")
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")

# ---------------------------------------------------------------------------
# Silence detection / cutting
# ---------------------------------------------------------------------------
SILENCE_NOISE_DB = "-30dB"   # below this level is considered silence
SILENCE_MIN_DUR = 0.5        # a gap must last at least this long to be removed (s)
KEEP_PADDING = 0.08          # keep this much extra on each side of a kept segment (s)

# ---------------------------------------------------------------------------
# Captions - Alex Hormozi style, tailored for Muslim content
# ---------------------------------------------------------------------------
# Big, bold, uppercase, few words at a time, with the spoken word "popping" in a
# punchy colour and a heavy black stroke. Sacred Islamic terms always render in a
# distinct colour so they stand out (see pipeline/islamic.py).
CAPTION_WORDS_PER_LINE = 3           # Hormozi look = few words on screen at once
CAPTION_FONT = os.environ.get("CAPTION_FONT", "Liberation Sans")  # bold via style; drop Montserrat in assets/fonts for the exact look
CAPTION_FONT_SIZE = 96               # in PlayRes (1080x1920) coords - big & bold
CAPTION_BASE_COLOR = "FFFFFF"        # white (RRGGBB, converted to ASS BGR)
CAPTION_HIGHLIGHT_COLOR = "FFD60A"   # gold - active/spoken word (Hormozi pop + Niyyah palette)
CAPTION_SACRED_COLOR = "2BD66A"      # green - sacred Islamic terms always highlighted
CAPTION_OUTLINE = 6                  # thick black stroke
CAPTION_SHADOW = 2
CAPTION_ALIGNMENT = 2                # ASS numpad: 2 = bottom-centre
CAPTION_MARGIN_V = 560               # distance from bottom -> lower-third safe zone above IG UI
CAPTION_POP = True                   # animate a scale "pop" on the spoken word

# Append the ﷺ honorific after the Prophet Muhammad's name. Requires a font with
# the glyph (Amiri is installed in the Docker image as a fallback).
APPEND_PBUH = os.environ.get("APPEND_PBUH", "1") not in ("0", "false", "False")
PBUH_SYMBOL = "ﷺ"               # ﷺ (Arabic ligature sallallahou alayhe wasallam)

# Directory of bundled fonts handed to libass (e.g. drop in Montserrat-Bold.ttf).
FONTS_DIR = BASE_DIR / "assets" / "fonts"

# ---------------------------------------------------------------------------
# Hook zoom / punch-ins
# ---------------------------------------------------------------------------
HOOK_ZOOM_DURATION = 1.5     # length of the opening hook punch-in (s)
HOOK_ZOOM_MAX = 1.08         # peak zoom factor (subtle)

# ---------------------------------------------------------------------------
# Uploads / jobs
# ---------------------------------------------------------------------------
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", 200 * 1024 * 1024))  # 200 MB
MAX_SOURCE_SECONDS = int(os.environ.get("MAX_SOURCE_SECONDS", 180))            # 3 min
JOB_TTL_HOURS = int(os.environ.get("JOB_TTL_HOURS", 24))
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv", ".3gp"}


def ensure_dirs() -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
