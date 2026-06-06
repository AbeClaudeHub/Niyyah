# One-Click Reels Editor

Upload a raw clip and get back an Instagram-Reels-ready vertical video — automatically.
No timeline, no manual editing: one button.

What it does to every upload:

1. **Normalize** — fixes frame rate, rotation, and audio so anything from your phone works.
2. **Cut dead air** — detects and removes silent gaps for tight, jump-cut pacing.
3. **Auto-captions (Alex-Hormozi style, tailored for Muslims)** — transcribes your speech
   (locally, free, no API keys) and burns in big bold uppercase captions where the spoken
   word "pops" in **gold**, with a heavy black stroke, positioned in the IG safe zone.
   Sacred Islamic terms (Allah, Qur'an, Jannah, Insha'Allah…) always render in **green** so
   they stand out, common terms are auto-corrected to clean spellings (e.g. "in sha allah"
   → *Insha'Allah*, "subhanallah" → *SubhanAllah*), and the **ﷺ** honorific is appended
   after the Prophet Muhammad's name. See `app/pipeline/islamic.py`.
4. **9:16 reframe** — center-crops/scales to exactly 1080×1920.
5. **Hook punch-in** — a subtle zoom on the opening to boost energy.
6. **Reels-spec encode** — H.264 / yuv420p / AAC / 30fps / faststart so IG won't recompress it.

It's a self-hosted web app: works in any browser, including your phone. Your video never
leaves your own server.

---

## Tech

- **Backend:** Python + FastAPI, ffmpeg (called directly), [faster-whisper](https://github.com/SYSTRAN/faster-whisper) for transcription.
- **Frontend:** plain HTML/CSS/JS served by FastAPI (no build step).
- **Jobs:** uploads are processed in the background; the page polls for progress.

```
app/
  main.py            FastAPI routes (upload / status / result) + static serving
  config.py          all tunables (model, thresholds, output spec, caps)
  jobs.py            in-memory job registry mirrored to status.json
  ffmpeg_utils.py    subprocess + ffprobe helpers
  pipeline/
    run.py           orchestrates the stages (cut -> transcribe -> render)
    normalize.py     step 0
    silence.py       silence detect + cut
    transcribe.py    faster-whisper word timestamps
    captions.py      .ass karaoke caption generation
    reframe.py       9:16 crop/scale + hook zoom filters
    encode.py        final single-pass ffmpeg encode
static/              index.html, app.js, styles.css
```

---

## Run locally

Requires **ffmpeg** on your PATH and Python 3.11+.

```bash
cd reels-editor
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000, drop in a clip, hit **Make it Reels-ready**.

The first run downloads the Whisper `base` model (~150 MB) to your cache.

### Customize the caption style (in the app)

Open **🎨 Customize captions** on the home page to change the spoken-word colour, the
sacred-term colour, words per line, on-screen position, the pop animation, and the ﷺ
honorific. Hit **Preview this style** to render a quick sample (a few seconds, no
transcription) before processing a real clip. Your choices are sent with the upload and
applied to the final video.

### Tuning (defaults & advanced)

Defaults live in `app/config.py` (or override via env vars): caption colors/size/safe-zone,
silence threshold, hook zoom strength, output quality, upload/duration caps, Whisper model
size (`WHISPER_MODEL=small` for more accuracy, slower). Per-request style validation /
whitelisting is in `app/style.py`.

---

## Deploy (Fly.io)

The included `Dockerfile` installs ffmpeg + fonts and **bakes the Whisper model into the
image** (no cold-start download). `fly.toml` mounts a volume for storage and sizes a 2 GB
machine (enough for `base` int8 + ffmpeg without OOM).

```bash
fly launch --no-deploy          # pick an app name, keep the existing fly.toml
fly volumes create reels_data --size 3
fly deploy
```

You'll get an HTTPS URL that works from your phone. Railway works too (point it at the
Dockerfile). Render's free tier will OOM — use a paid instance if you go there.

---

## Notes & limits (v1)

- **Static center crop** (no face tracking yet) — works great for centered talking-head /
  handheld footage; off-center subjects in landscape may crop imperfectly.
- **Processing takes minutes**, not seconds, on cheap CPU. A 1-min clip ≈ 3–6 min end-to-end.
- **Captions are burned in permanently** and best on clear English speech.
- Uploads are capped (default 200 MB / 3 min) — tune in `config.py`.
- Single worker: one job at a time, by design, to protect memory.
