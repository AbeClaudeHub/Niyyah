"""Step 2 - Transcribe with faster-whisper, producing word-level timestamps.

The model is loaded lazily and cached process-wide (loading is the expensive
part). Returns a flat list of {"word", "start", "end"} dicts, already in the
final timeline because we transcribe the silence-cut clip.
"""

from __future__ import annotations

import threading
from pathlib import Path

from .. import config

_model = None
_model_lock = threading.Lock()


def _get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                # Imported here so the web process can start even before the
                # (heavy) dependency tree is touched.
                from faster_whisper import WhisperModel

                _model = WhisperModel(
                    config.WHISPER_MODEL,
                    device=config.WHISPER_DEVICE,
                    compute_type=config.WHISPER_COMPUTE_TYPE,
                )
    return _model


def transcribe(src: Path) -> list[dict]:
    model = _get_model()
    segments, _info = model.transcribe(
        str(src),
        word_timestamps=True,
        vad_filter=True,
    )

    words: list[dict] = []
    for seg in segments:
        for w in (seg.words or []):
            text = w.word.strip()
            if not text:
                continue
            start = float(w.start)
            end = float(w.end)
            if end <= start:
                end = start + 0.1
            words.append({"word": text, "start": start, "end": end})
    return words
