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
# Captions
# ---------------------------------------------------------------------------
CAPTION_WORDS_PER_LINE = 4          # words shown on screen at once
CAPTION_FONT = "DejaVu Sans"         # available in the slim image; bold via style
CAPTION_FONT_SIZE = 80               # in PlayRes (1080x1920) coords
CAPTION_BASE_COLOR = "FFFFFF"        # white (RRGGBB, converted to ASS BGR)
CAPTION_HIGHLIGHT_COLOR = "21E635"   # punchy green for the active word
CAPTION_OUTLINE = 4
CAPTION_MARGIN_V = 470               # distance from bottom -> safe zone above IG UI

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
