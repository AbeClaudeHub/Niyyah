"""Step 3 - Build an animated, word-by-word ("karaoke") .ass caption file.

We render one short line (a few words) on screen at a time, and emit one Dialogue
event per word so the currently-spoken word pops (accent colour + slight scale).
Each word's event extends until the next word begins, so the line stays visible
and continuous instead of flickering between words.

Positioning uses bottom-centre alignment with a large vertical margin so text
sits in the IG "safe zone" — above the caption/username/audio row and clear of
the right-hand action rail.
"""

from __future__ import annotations

from pathlib import Path

from .. import config


def _ass_time(t: float) -> str:
    """Seconds -> H:MM:SS.cc (ASS uses centiseconds)."""
    if t < 0:
        t = 0.0
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    cs = int(round((t - int(t)) * 100))
    if cs == 100:  # rounding spillover
        cs = 0
        s += 1
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _ass_color(rrggbb: str) -> str:
    """Convert an RRGGBB hex string to ASS &HBBGGRR& (BGR, no alpha)."""
    rrggbb = rrggbb.lstrip("#")
    r, g, b = rrggbb[0:2], rrggbb[2:4], rrggbb[4:6]
    return f"&H00{b}{g}{r}".upper() + "&"


def _chunk(words: list[dict], per_line: int) -> list[list[dict]]:
    return [words[i:i + per_line] for i in range(0, len(words), per_line)]


def build_ass(words: list[dict], dst: Path) -> None:
    base = _ass_color(config.CAPTION_BASE_COLOR)
    highlight = _ass_color(config.CAPTION_HIGHLIGHT_COLOR)
    outline_col = "&H00000000&"  # opaque black

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {config.OUT_WIDTH}
PlayResY: {config.OUT_HEIGHT}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{config.CAPTION_FONT},{config.CAPTION_FONT_SIZE},{base},{base},{outline_col},&H64000000,-1,0,0,0,100,100,0,0,1,{config.CAPTION_OUTLINE},2,2,60,60,{config.CAPTION_MARGIN_V},1

[Events]
Format: Layer, Start, End, Style, MarginL, MarginR, MarginV, Effect, Text
"""

    lines = _chunk(words, config.CAPTION_WORDS_PER_LINE)
    events: list[str] = []

    for line in lines:
        if not line:
            continue
        line_end = line[-1]["end"]
        for i, w in enumerate(line):
            start = w["start"]
            # Keep the line visible until the next word starts (no flicker).
            end = line[i + 1]["start"] if i + 1 < len(line) else line_end
            if end <= start:
                end = start + 0.12

            rendered = []
            for j, lw in enumerate(line):
                token = lw["word"].upper()
                if j == i:
                    rendered.append(
                        f"{{\\1c{highlight}\\fscx112\\fscy112}}{token}{{\\r}}"
                    )
                else:
                    rendered.append(token)
            text = " ".join(rendered)
            events.append(
                f"Dialogue: 0,{_ass_time(start)},{_ass_time(end)},Default,,0,0,0,,{text}"
            )

    dst.write_text(header + "\n".join(events) + "\n", encoding="utf-8")
