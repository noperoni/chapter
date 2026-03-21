FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download bundled English voices from HuggingFace piper-voices repo
# URL pattern: /en/{lang_region}/{lang_region}-{name}/{quality}/{voice_id}.onnx
ENV HF_BASE=https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0

RUN mkdir -p /app/voices && cd /app/voices && \
    wget -q "${HF_BASE}/en/en_US/en_US-lessac/medium/en_US-lessac-medium.onnx" && \
    wget -q "${HF_BASE}/en/en_US/en_US-lessac/medium/en_US-lessac-medium.onnx.json" && \
    wget -q "${HF_BASE}/en/en_US/en_US-libritts_r/medium/en_US-libritts_r-medium.onnx" && \
    wget -q "${HF_BASE}/en/en_US/en_US-libritts_r/medium/en_US-libritts_r-medium.onnx.json" && \
    wget -q "${HF_BASE}/en/en_US/en_US-amy/medium/en_US-amy-medium.onnx" && \
    wget -q "${HF_BASE}/en/en_US/en_US-amy/medium/en_US-amy-medium.onnx.json" && \
    wget -q "${HF_BASE}/en/en_US/en_US-ryan/medium/en_US-ryan-medium.onnx" && \
    wget -q "${HF_BASE}/en/en_US/en_US-ryan/medium/en_US-ryan-medium.onnx.json" && \
    wget -q "${HF_BASE}/en/en_GB/en_GB-alba/medium/en_GB-alba-medium.onnx" && \
    wget -q "${HF_BASE}/en/en_GB/en_GB-alba/medium/en_GB-alba-medium.onnx.json" && \
    wget -q "${HF_BASE}/en/en_GB/en_GB-aru/medium/en_GB-aru-medium.onnx" && \
    wget -q "${HF_BASE}/en/en_GB/en_GB-aru/medium/en_GB-aru-medium.onnx.json"

COPY server.py .

EXPOSE 5000

CMD ["python", "server.py"]
