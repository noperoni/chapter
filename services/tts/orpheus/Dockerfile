FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3.11 python3.11-venv python3-pip \
    git wget \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3.11 /usr/bin/python

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the model weights at build time
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download('canopylabs/orpheus-3b-0.1-ft')"

COPY server.py .

EXPOSE 5000

CMD ["python", "server.py"]
