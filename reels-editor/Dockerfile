FROM python:3.11-slim

# ffmpeg for all media work; fonts-dejavu so libass can render the captions.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the Whisper model into the image so there is no cold-start download.
ENV WHISPER_MODEL=base
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('${WHISPER_MODEL}', device='cpu', compute_type='int8')"

COPY app ./app
COPY static ./static

# Storage lives on a mounted volume in production.
ENV STORAGE_DIR=/data/storage
RUN mkdir -p /data/storage

EXPOSE 8080
# Single worker: serializes heavy jobs and keeps the cached model in one process.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
