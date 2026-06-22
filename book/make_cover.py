#!/usr/bin/env python3
"""Generate the cover for The Trader and the Nafs.

Concept 'The Mirror': a gold candlestick chart falls to a low and recovers,
then reflects beneath a luminous water-line — the market as a mirror of the
self. Premium midnight/gold palette, a faint Islamic star medallion, gold-foil
title, film grain and vignette. Title set in Playfair Display, kicker/author in
Cinzel, subtitle in EB Garamond italic. Outputs 1600x2400 PNG + JPG.
"""
import os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
try:
    import numpy as np
except Exception:
    np = None

HERE = os.path.dirname(__file__)
FONTS = os.path.join(HERE, "fonts")
ASSETS = os.path.join(HERE, "assets")
W, H = 1600, 2400
CX = W // 2

# ---- palette ----
GOLD_HI   = (242, 214, 132)
GOLD      = (201, 162, 74)
GOLD_DEEP = (150, 112, 42)
WHITE     = (246, 243, 235)
MUTED     = (146, 154, 168)
LIGHT     = (216, 211, 200)
INK_TOP   = (15, 22, 34)
INK_MID   = (10, 15, 24)
INK_BOT   = (5, 7, 12)

def _f(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)

def vfont(name, size, weight):
    f = _f(name, size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass
    return f

PLAY  = lambda s, w=800: vfont("PlayfairDisplay-Variable.ttf", s, w)
CINZ  = lambda s, w=600: vfont("Cinzel-Variable.ttf", s, w)
GAR_I = lambda s: _f("EBGaramond-Italic.ttf", s)
INT_M = lambda s: _f("Inter-Medium.ttf", s)

# ---- background gradient (three-stop, vertical) ----
def vgrad(stops):
    img = Image.new("RGB", (1, H))
    px = img.load()
    seg = H / (len(stops) - 1)
    for y in range(H):
        i = min(int(y / seg), len(stops) - 2)
        t = (y - i * seg) / seg
        a, b = stops[i], stops[i + 1]
        px[0, y] = tuple(int(a[k] + (b[k] - a[k]) * t) for k in range(3))
    return img.resize((W, H))

base = vgrad([INK_TOP, INK_MID, INK_BOT])
draw = ImageDraw.Draw(base, "RGBA")

# ---- faint Islamic star medallion (texture behind the title) ----
med = Image.new("RGBA", (W, H), (0, 0, 0, 0))
md = ImageDraw.Draw(med)
mcx, mcy = CX, 770
def star_poly(cx, cy, R, r, n=8, rot=0.0):
    pts = []
    for i in range(2 * n):
        ang = math.pi / n * i - math.pi / 2 + rot
        rad = R if i % 2 == 0 else r
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    return pts
for R in (520, 430, 340):
    md.polygon(star_poly(mcx, mcy, R, R*0.62, 8, 0.0), outline=(201,162,74,26), width=2)
    md.polygon(star_poly(mcx, mcy, R, R*0.62, 8, math.pi/8), outline=(201,162,74,22), width=2)
for ring in (300, 540):
    md.ellipse([mcx-ring, mcy-ring, mcx+ring, mcy+ring], outline=(201,162,74,18), width=2)
med = med.filter(ImageFilter.GaussianBlur(1.4))
base = Image.alpha_composite(base.convert("RGBA"), med).convert("RGB")
draw = ImageDraw.Draw(base, "RGBA")

# ---- radial gold glow behind NAFS ----
glow = Image.new("L", (W, H), 0)
ImageDraw.Draw(glow).ellipse([CX-560, 600, CX+560, 1160], fill=78)
glow = glow.filter(ImageFilter.GaussianBlur(190))
base = Image.composite(Image.new("RGB", (W, H), GOLD_DEEP), base, glow)
draw = ImageDraw.Draw(base, "RGBA")

# ---- text helpers ----
def tracked(d, cx, y, text, fnt, fill, tracking):
    widths = [d.textlength(c, font=fnt) for c in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = cx - total / 2
    asc, _ = fnt.getmetrics()
    for c, w in zip(text, widths):
        d.text((x, y - asc), c, font=fnt, fill=fill)
        x += w + tracking

def center(d, cx, y, text, fnt, fill):
    d.text((cx, y), text, font=fnt, fill=fill, anchor="mm")

def gradient_text(dst, cx, cy, text, fnt, top, bottom, highlight=True, shadow=True):
    bb = fnt.getbbox(text)
    tw, th = bb[2]-bb[0], bb[3]-bb[1]
    pad = 60
    mask = Image.new("L", (tw+2*pad, th+2*pad), 0)
    ImageDraw.Draw(mask).text((pad-bb[0], pad-bb[1]), text, font=fnt, fill=255)
    mw, mh = mask.size
    px = cx - mw//2
    py = cy - mh//2
    if shadow:
        sh = mask.filter(ImageFilter.GaussianBlur(7))
        shimg = Image.new("RGBA", (mw, mh), (0, 0, 0, 0))
        shimg.putalpha(Image.eval(sh, lambda v: int(v*0.55)))
        dst.alpha_composite(shimg, (px, py+8))
    grad = Image.new("RGB", (mw, mh))
    gp = grad.load()
    for yy in range(mh):
        t = yy / (mh-1)
        # specular band near 28%
        spec = max(0.0, 1 - abs(t-0.26)/0.16)
        col = [int(top[k] + (bottom[k]-top[k])*t) for k in range(3)]
        if highlight:
            col = [min(255, int(col[k] + (255-col[k])*0.5*spec)) for k in range(3)]
        for xx in range(mw):
            gp[xx, yy] = tuple(col)
    dst.alpha_composite(Image.composite(grad.convert("RGBA"),
                        Image.new("RGBA", (mw, mh), (0,0,0,0)), mask), (px, py))

def star8(d, cx, cy, R, r, outline, width=3, fill=None):
    d.polygon(star_poly(cx, cy, R, r, 8), fill=fill, outline=outline)
    d.ellipse([cx-4, cy-4, cx+4, cy+4], fill=outline)

# ---- frame + corner flourishes ----
m = 44
draw.rectangle([m, m, W-m, H-m], outline=(201,162,74,95), width=2)
draw.rectangle([m+11, m+11, W-m-11, H-m-11], outline=(201,162,74,38), width=1)
def corner(cx, cy, sx, sy):
    L = 46
    draw.line([cx, cy, cx+L*sx, cy], fill=GOLD+(230,), width=2)
    draw.line([cx, cy, cx, cy+L*sy], fill=GOLD+(230,), width=2)
    draw.polygon([(cx+12*sx, cy+12*sy),(cx+22*sx, cy+12*sy),(cx+12*sx, cy+22*sy)], fill=GOLD+(220,))
for (sx, sy), (cx, cy) in [((1,1),(m+24,m+24)),((-1,1),(W-m-24,m+24)),
                           ((1,-1),(m+24,H-m-24)),((-1,-1),(W-m-24,H-m-24))]:
    corner(cx, cy, sx, sy)

# ---- top emblem + kicker (positioning) ----
star8(draw, CX, 232, 40, 16, outline=GOLD, width=3, fill=(201,162,74,30))
draw.ellipse([CX-58, 232-58, CX+58, 232+58], outline=(201,162,74,70), width=2)
tracked(draw, CX, 348, "THE ISLAMIC PSYCHOLOGY OF SELF-MASTERY", CINZ(31, 600), GOLD, 5)

# ---- title ----
center(draw, CX, 488, "THE TRADER", PLAY(120, 800), WHITE)
tracked(draw, CX, 590, "AND THE", INT_M(40), MUTED, 16)

base = base.convert("RGBA")
gradient_text(base, CX, 800, "NAFS", PLAY(338, 900), GOLD_HI, GOLD_DEEP)
base = base.convert("RGB")
draw = ImageDraw.Draw(base, "RGBA")

draw.line([CX-80, 968, CX-14, 968], fill=GOLD, width=2)
draw.line([CX+14, 968, CX+80, 968], fill=GOLD, width=2)
draw.polygon([(CX,960),(CX+10,968),(CX,976),(CX-10,968)], fill=GOLD)

# ---- subtitle hook ----
center(draw, CX, 1052, "Mastering the Self Before Mastering the Market", GAR_I(52), LIGHT)

# ---- Qur'an quote ----
center(draw, CX, 1180, "“The self is a persistent commander of evil…”", GAR_I(40), MUTED)
tracked(draw, CX, 1238, "QUR’AN 12:53", CINZ(23, 600), GOLD, 5)

# ============================================================
#  HERO: candlestick chart, fall and recovery, then reflection
# ============================================================
chart = Image.new("RGBA", (W, H), (0, 0, 0, 0))
cd = ImageDraw.Draw(chart)
x0, x1 = 228, W - 228
mirror_y = 1788
top_y, bot_y = 1378, mirror_y - 16
closes = [0.60,0.53,0.45,0.36,0.27,0.18,0.11,0.09,0.18,0.30,0.43,0.56,0.69,0.82,0.91]
n = len(closes); slot = (x1 - x0) / n; bw = slot * 0.56
def py(p): return bot_y - p * (bot_y - top_y)
prev = 0.67
for i, c in enumerate(closes):
    o = prev; cxn = x0 + slot*(i+0.5); up = c >= o
    yo, yc = py(o), py(c)
    yh = py(min(max(o,c)+0.05, 1.0)); yl = py(max(min(o,c)-0.05, 0.0))
    body = GOLD_HI if up else GOLD
    cd.line([cxn, yh, cxn, yl], fill=body+(255,), width=3)
    bx0, bx1 = cxn-bw/2, cxn+bw/2
    ytop, ybot = min(yo, yc), max(yo, yc)
    if ybot-ytop < 7: ybot = ytop+7
    cd.rectangle([bx0, ytop, bx1, ybot], fill=body+(255,))
    if up:
        cd.rectangle([bx0, ytop, bx1, ybot], outline=(255,236,182,170), width=2)
    prev = c
cd.line([(x0+slot*(i+0.5), py(c)) for i, c in enumerate(closes)], fill=GOLD+(55,), width=2)
base = Image.alpha_composite(base.convert("RGBA"), chart).convert("RGB")
draw = ImageDraw.Draw(base, "RGBA")

# water line (mirror surface)
gl = Image.new("L", (W, H), 0)
ImageDraw.Draw(gl).line([x0-34, mirror_y, x1+34, mirror_y], fill=255, width=3)
gl = gl.filter(ImageFilter.GaussianBlur(6))
base = Image.composite(Image.new("RGB", (W, H), GOLD_HI), base, gl)
draw = ImageDraw.Draw(base, "RGBA")
draw.line([x0+50, mirror_y, x1-50, mirror_y], fill=GOLD_HI+(235,), width=2)

# reflection (flipped, faded like water)
refl_h = 320
crop = chart.crop((0, top_y-10, W, mirror_y)).transpose(Image.FLIP_TOP_BOTTOM)
ch = crop.size[1]
col = Image.new("L", (1, ch), 0); cp = col.load()
for y in range(ch):
    cp[0, y] = int(130 * max(0.0, 1 - (y/refl_h)**0.9))
fade = col.resize(crop.size)
r, g, b, a = crop.split()
refl = Image.merge("RGBA", (r, g, b, ImageChops.multiply(a, fade))).filter(ImageFilter.GaussianBlur(2))
brgba = base.convert("RGBA"); brgba.alpha_composite(refl, (0, mirror_y))
base = brgba.convert("RGB")
draw = ImageDraw.Draw(base, "RGBA")

# ---- author block ----
ay = 2150
draw.line([CX-130, ay, CX+130, ay], fill=GOLD, width=2)
draw.polygon([(CX,ay-7),(CX+9,ay),(CX,ay+7),(CX-9,ay)], fill=GOLD)
tracked(draw, CX, ay+82, "ABRIHYM AOBAD", CINZ(48, 600), WHITE, 8)
tracked(draw, CX, ay+140, "FOUNDER OF NIYYAH", INT_M(26), GOLD, 6)

# ---- vignette ----
vig = Image.new("L", (W, H), 0)
ImageDraw.Draw(vig).rectangle([0, 0, W, H], fill=0)
ImageDraw.Draw(vig).ellipse([-260, -360, W+260, H+360], fill=255)
vig = vig.filter(ImageFilter.GaussianBlur(260))
dark = Image.new("RGB", (W, H), (0, 0, 0))
base = Image.composite(base, dark, vig)

# ---- film grain ----
if np is not None:
    arr = np.asarray(base).astype(np.int16)
    noise = np.random.normal(0, 4.0, (H, W, 1)).astype(np.int16)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    base = Image.fromarray(arr, "RGB")

# ---- save ----
base.save(os.path.join(ASSETS, "cover.png"))
base.save(os.path.join(ASSETS, "cover.jpg"), quality=92)
print("cover written", base.size)
