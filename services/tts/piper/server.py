#!/usr/bin/env python3
"""
Piper TTS HTTP Service — standardized wrapper for TTS Model Manager.
CPU-only, fast, 300+ voices. Downloads voice models on demand.
Exposes /health, /voices, /synthesize with the standard contract.
"""

import io
import os
import json
import wave
import subprocess
from pathlib import Path
from flask import Flask, request, jsonify, send_file

app = Flask(__name__)

VOICES_DIR = Path(os.environ.get("VOICES_DIR", "/app/voices"))
SAMPLE_RATE = 22050  # Piper default
DEFAULT_VOICE = "en_US-lessac-medium"

# Bundled voices (downloaded at build time)
BUNDLED_VOICES = [
    {"id": "en_US-lessac-medium", "name": "Lessac", "gender": "male", "language": "en-US"},
    {"id": "en_US-libritts_r-medium", "name": "LibriTTS", "gender": "neutral", "language": "en-US"},
    {"id": "en_US-amy-medium", "name": "Amy", "gender": "female", "language": "en-US"},
    {"id": "en_US-ryan-medium", "name": "Ryan", "gender": "male", "language": "en-US"},
    {"id": "en_GB-alba-medium", "name": "Alba", "gender": "female", "language": "en-GB"},
    {"id": "en_GB-aru-medium", "name": "Aru", "gender": "male", "language": "en-GB"},
]


def get_model_path(voice_id: str) -> Path:
    return VOICES_DIR / f"{voice_id}.onnx"


def get_config_path(voice_id: str) -> Path:
    return VOICES_DIR / f"{voice_id}.onnx.json"


def voice_available(voice_id: str) -> bool:
    return get_model_path(voice_id).exists() and get_config_path(voice_id).exists()


def get_sample_rate(voice_id: str) -> int:
    """Read sample rate from voice config JSON."""
    config_path = get_config_path(voice_id)
    if config_path.exists():
        with open(config_path) as f:
            config = json.load(f)
            return config.get("audio", {}).get("sample_rate", SAMPLE_RATE)
    return SAMPLE_RATE


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "piper"})


@app.route("/voices", methods=["GET"])
def voices():
    available = [v for v in BUNDLED_VOICES if voice_available(v["id"])]
    return jsonify(available)


@app.route("/synthesize", methods=["POST"])
def synthesize():
    try:
        data = request.get_json()
        if not data or "text" not in data:
            return jsonify({"error": "Missing required field: text"}), 400

        text = data["text"]
        voice = data.get("voice", DEFAULT_VOICE)
        speed = float(data.get("speed", 1.0))

        model_path = get_model_path(voice)
        if not model_path.exists():
            return jsonify({"error": f"Voice not available: {voice}"}), 400

        sample_rate = get_sample_rate(voice)

        # Run piper CLI to generate audio
        # Piper outputs raw 16-bit PCM to stdout when using --output-raw
        length_scale = 1.0 / speed  # Piper: lower = faster

        result = subprocess.run(
            [
                "piper",
                "--model", str(model_path),
                "--output-raw",
                "--length-scale", str(length_scale),
            ],
            input=text.encode("utf-8"),
            capture_output=True,
            timeout=120,
        )

        if result.returncode != 0:
            error_msg = result.stderr.decode("utf-8", errors="replace")
            return jsonify({"error": f"Piper failed: {error_msg}"}), 500

        raw_audio = result.stdout
        if not raw_audio:
            return jsonify({"error": "No audio generated"}), 500

        # Wrap raw PCM in WAV container
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(raw_audio)
        wav_buffer.seek(0)

        duration = len(raw_audio) / (sample_rate * 2)  # 2 bytes per sample

        response = send_file(
            wav_buffer,
            mimetype="audio/wav",
            as_attachment=False,
            download_name="speech.wav",
        )
        response.headers["X-Audio-Duration"] = str(duration)
        response.headers["X-Sample-Rate"] = str(sample_rate)
        return response

    except subprocess.TimeoutExpired:
        return jsonify({"error": "Piper synthesis timed out"}), 504
    except Exception as e:
        print(f"Error generating speech: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Piper TTS server on port {port}...")
    print(f"Voices directory: {VOICES_DIR}")
    available = [v["id"] for v in BUNDLED_VOICES if voice_available(v["id"])]
    print(f"Available voices: {available}")
    app.run(host="0.0.0.0", port=port, debug=False)
