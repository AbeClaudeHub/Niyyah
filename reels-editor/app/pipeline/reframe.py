"""Step 4 & 5 - Build the 9:16 reframe and hook zoom filter strings.

v1 uses a static, centre-biased crop (no face tracking). The hook zoom is a
single subtle punch-in over the opening seconds that settles back to normal, so
the rest of the clip is never permanently cropped.
"""

from __future__ import annotations

from .. import config

_TARGET_AR = config.OUT_WIDTH / config.OUT_HEIGHT  # 0.5625 for 9:16


def reframe_filter(src_w: int, src_h: int) -> str:
    """Return the crop+scale filter to make any input exactly 1080x1920."""
    w, h = config.OUT_WIDTH, config.OUT_HEIGHT
    src_ar = src_w / src_h if src_h else _TARGET_AR

    if src_ar > _TARGET_AR:
        # Wider than 9:16 (e.g. landscape): crop a full-height vertical slice
        # from the horizontal centre, then upscale.
        return f"crop=ih*{w}/{h}:ih,scale={w}:{h}:flags=lanczos"
    # Narrower/taller than 9:16 (portrait): scale to cover, then centre-crop.
    return (
        f"scale={w}:{h}:flags=lanczos:force_original_aspect_ratio=increase,"
        f"crop={w}:{h}"
    )


def hook_zoom_filter() -> str:
    """Return a zoompan filter that punches in on the opening hook and settles.

    Operates on an input that is already 1080x1920. Zoom starts at HOOK_ZOOM_MAX
    at t=0 and eases to 1.0 by HOOK_ZOOM_DURATION; flat 1.0 afterwards.
    """
    dur_frames = max(1, int(config.HOOK_ZOOM_DURATION * config.FPS))
    zmax = config.HOOK_ZOOM_MAX
    z_expr = f"if(lt(on,{dur_frames}),1+({zmax}-1)*(1-on/{dur_frames}),1)"
    return (
        f"zoompan=z='{z_expr}'"
        f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        f":d=1:s={config.OUT_WIDTH}x{config.OUT_HEIGHT}:fps={config.FPS}"
    )
