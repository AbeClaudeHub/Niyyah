"""Step 3 - Build animated, Alex-Hormozi-style .ass captions, tuned for Muslims.

We render a few big bold uppercase words at a time and emit one Dialogue event
per word so the spoken word "pops" (scale animation) in a gold highlight. Sacred
Islamic terms (Allah, Qur'an, Jannah...) always render in green so they stand out
even when not the active word. Each word's event extends until the next word
begins, so the line stays visible and continuous instead of flickering.

Positioning uses bottom-centre alignment with a large vertical margin so text
sits in the IG "safe zone" — above the caption/username/audio row and clear of
the right-hand action rail.
"""

from __future__ import annotations

from pathlib import Path

from .. import config
from . import islamic


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


def _token(text: str, *, active: bool, sacred: bool, style: dict) -> str:
    """Render one word with the right colour / pop animation override tags."""
    word = text.upper()
    if active:
        hexcol = style["sacred_color"] if sacred else style["highlight_color"]
        color = _ass_color(hexcol)
        if style["pop"]:
            # Pop from 80% -> 116% over 110ms for that punchy Hormozi snap.
            anim = "\\fscx80\\fscy80\\t(0,110,\\fscx116\\fscy116)"
        else:
            anim = "\\fscx112\\fscy112"
        return f"{{\\1c{color}{anim}}}{word}{{\\r}}"
    if sacred:
        # Sacred terms always stand out, even when not the spoken word.
        return f"{{\\1c{_ass_color(style['sacred_color'])}}}{word}{{\\r}}"
    return word


def build_ass(words: list[dict], dst: Path, style: dict | None = None) -> None:
    from .. import style as style_mod  # local import avoids a cycle at import time

    s = style_mod.resolve(style)  # idempotent: accepts None, partial, or full dict
    base = _ass_color(s["base_color"])
    outline_col = "&H00000000&"  # opaque black

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {config.OUT_WIDTH}
PlayResY: {config.OUT_HEIGHT}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{s['font']},{s['font_size']},{base},{base},{outline_col},&H64000000,-1,0,0,0,100,100,0,0,1,{s['outline']},{s['shadow']},{s['alignment']},80,80,{s['margin_v']},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    lines = _chunk(words, s["words_per_line"])
    sacred_flags = [[islamic.is_sacred(w["word"]) for w in line] for line in lines]
    events: list[str] = []

    for line, sacreds in zip(lines, sacred_flags):
        if not line:
            continue
        line_end = line[-1]["end"]
        for i, w in enumerate(line):
            start = w["start"]
            # Keep the line visible until the next word starts (no flicker).
            end = line[i + 1]["start"] if i + 1 < len(line) else line_end
            if end <= start:
                end = start + 0.12

            text = " ".join(
                _token(lw["word"], active=(j == i), sacred=sacreds[j], style=s)
                for j, lw in enumerate(line)
            )
            events.append(
                f"Dialogue: 0,{_ass_time(start)},{_ass_time(end)},Default,,0,0,0,,{text}"
            )

    dst.write_text(header + "\n".join(events) + "\n", encoding="utf-8")
