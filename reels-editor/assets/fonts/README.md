# Bundled caption fonts

Drop a `.ttf`/`.otf` here to use it for captions, then set the family name in
`app/config.py` (or the `CAPTION_FONT` env var).

For the exact Alex-Hormozi look, add **Montserrat** (ExtraBold/Black) — e.g.
`Montserrat-ExtraBold.ttf` — and set:

```
CAPTION_FONT="Montserrat ExtraBold"
```

Any font placed in this folder is passed to libass via the subtitles filter's
`fontsdir`, so no system install is needed. The ﷺ honorific glyph is supplied by
the Amiri font (installed in the Docker image) as a fallback when the caption
font lacks it.
