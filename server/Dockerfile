FROM python:3.11-slim

# opencv-python-headless still links against these shared libs at import time.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# rtmlib declares full opencv-python as a dependency; install it --no-deps and
# supply the headless equivalent + its real needs from requirements.txt instead.
COPY requirements.txt .
RUN grep -v "^rtmlib" requirements.txt > /tmp/base.txt \
    && pip install --no-cache-dir -r /tmp/base.txt \
    && pip install --no-cache-dir --no-deps "$(grep '^rtmlib' requirements.txt)"

# Bake the pinned models into the image at build time. --verify fails the build
# on any SHA-256 mismatch with models.lock, so the image can never silently
# contain different weights than the ones results were validated against.
COPY models.lock .
COPY scripts/download_models.py scripts/
RUN python scripts/download_models.py --verify

COPY inference.py app.py ./

# HF Spaces runs the container as a non-root user with a random uid.
RUN chmod -R a+r /app

# Cloud Run injects PORT (8080); HF Spaces and local runs fall back to 7860.
EXPOSE 7860
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-7860} --workers 1"]
