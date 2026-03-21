FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    git \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download Kokoro v1.0 model + voices
RUN mkdir -p /root/.cache/kokoro && \
    cd /root/.cache/kokoro && \
    wget https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx && \
    wget https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin && \
    mv voices-v1.0.bin voices.bin

COPY server.py .

EXPOSE 5000

CMD ["python", "server.py"]
