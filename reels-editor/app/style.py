"""Resolve and validate caption-style overrides.

Style values can come from the web UI (preview + per-job), so every value is
validated/sanitised here before it reaches an .ass file or an ffmpeg filter.
Unknown or malformed values fall back to the defaults in config.py.
"""

from __future__ import annotations

import re

from . import config

_HEX = re.compile(r"^[0-9a-fA-F]{6}$")

# Fonts the UI may select. Restricting to a whitelist keeps arbitrary strings
# out of the .ass style line. Add a family here after bundling its .ttf.
ALLOWED_FONTS = {
    "Liberation Sans",
    "DejaVu Sans",
    "Montserrat",
    "Montserrat ExtraBold",
    "Anton",
}

# field -> (config attribute, type)
FIELDS: dict[str, tuple[str, type]] = {
    "font": ("CAPTION_FONT", str),
    "font_size": ("CAPTION_FONT_SIZE", int),
    "words_per_line": ("CAPTION_WORDS_PER_LINE", int),
    "base_color": ("CAPTION_BASE_COLOR", str),
    "highlight_color": ("CAPTION_HIGHLIGHT_COLOR", str),
    "sacred_color": ("CAPTION_SACRED_COLOR", str),
    "outline": ("CAPTION_OUTLINE", int),
    "shadow": ("CAPTION_SHADOW", int),
    "alignment": ("CAPTION_ALIGNMENT", int),
    "margin_v": ("CAPTION_MARGIN_V", int),
    "pop": ("CAPTION_POP", bool),
    "append_pbuh": ("APPEND_PBUH", bool),
}

_FALSEY = {"0", "false", "no", "off", "", "none"}


def _to_bool(v) -> bool:
    return str(v).strip().lower() not in _FALSEY


def _clean_hex(v, fallback: str) -> str:
    s = str(v).lstrip("#").strip()
    return s.upper() if _HEX.match(s) else fallback


def resolve(overrides: dict | None = None) -> dict:
    """Return a complete, validated style dict (defaults + sanitised overrides)."""
    overrides = overrides or {}
    style: dict = {}
    for key, (attr, typ) in FIELDS.items():
        default = getattr(config, attr)
        val = overrides.get(key, None)
        if val is None or val == "":
            style[key] = default
            continue
        try:
            if typ is bool:
                style[key] = _to_bool(val)
            elif typ is int:
                style[key] = int(val)
            else:
                style[key] = str(val)
        except (ValueError, TypeError):
            style[key] = default

    # Sanitise / clamp.
    style["base_color"] = _clean_hex(style["base_color"], config.CAPTION_BASE_COLOR)
    style["highlight_color"] = _clean_hex(style["highlight_color"], config.CAPTION_HIGHLIGHT_COLOR)
    style["sacred_color"] = _clean_hex(style["sacred_color"], config.CAPTION_SACRED_COLOR)
    if style["font"] not in ALLOWED_FONTS:
        style["font"] = config.CAPTION_FONT
    style["font_size"] = max(40, min(140, style["font_size"]))
    style["words_per_line"] = max(1, min(5, style["words_per_line"]))
    style["outline"] = max(0, min(12, style["outline"]))
    style["shadow"] = max(0, min(8, style["shadow"]))
    style["alignment"] = style["alignment"] if style["alignment"] in (2, 5, 8) else config.CAPTION_ALIGNMENT
    style["margin_v"] = max(0, min(1700, style["margin_v"]))
    return style
