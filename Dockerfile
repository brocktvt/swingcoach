FROM python:3.11-slim

WORKDIR /app

# System deps required by mediapipe and opencv
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir --force-reinstall "bcrypt==3.2.2"

COPY api/ .

CMD uvicorn main:app --host 0.0.0.0 --port $PORT
