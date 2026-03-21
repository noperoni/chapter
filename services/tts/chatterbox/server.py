#!/usr/bin/env python3
"""
Chatterbox TTS HTTP Service — standardized wrapper for TTS Model Manager.
Wraps resemble-ai/chatterbox (Original or Turbo variant via MODEL_VARIANT env).
Exposes /health, /voices, /synthesize with the standard contract.
"""

import io
import os
import wave
import numpy as np
import torch
import torchaudio
from flask import Flask, request, jsonify, send_file

app = Flask(__name__)

MODEL_VARIANT = os.environ.get("MODEL_VARIANT", "turbo")
SAMPLE_RATE = 24000
DEFAULT_VOICE = "default"

print(f"Loading Chatterbox TTS ({MODEL_VARIANT} variant)...")

if MODEL_VARIANT == "turbo":
    from chatterbox.tts import ChatterboxTTSTurbo
    model = ChatterboxTTSTurbo.from_pretrained(device="cuda")
    MODEL_LABEL = "chatterbox-turbo"
else:
    from chatterbox.tts import ChatterboxTTS
    model = ChatterboxTTS.from_pretrained(device="cuda")
    MODEL_LABEL = "chatterbox"

print(f"Chatterbox TTS ({MODEL_VARIANT}) loaded successfully!")

VOICES = [
    {"id": "default", "name": "Default", "gender": "female", "language": "en"},
]

VALID_VOICE_IDS = {v["id"] for v in VOICES}


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL_LABEL})


@app.route("/voices", methods=["GET"])
def voices():
    return jsonify(VOICES)


@app.route("/synthesize", methods=["POST"])
def synthesize():
    try:
        data = request.get_json()
        if not data or "text" not in data:
            return jsonify({"error": "Missing required field: text"}), 400

        text = data["text"]

        # Generate speech
        wav_tensor = model.generate(text)

        # wav_tensor is a torch tensor [1, samples] at 24kHz
        if wav_tensor.dim() > 1:
            wav_tensor = wav_tensor.squeeze(0)

        audio_np = wav_tensor.cpu().numpy()
        audio_int16 = (audio_np * 32767).astype(np.int16)

        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(audio_int16.tobytes())
        wav_buffer.seek(0)

        duration = len(audio_int16) / SAMPLE_RATE

        response = send_file(
            wav_buffer,
            mimetype="audio/wav",
            as_attachment=False,
            download_name="speech.wav",
        )
        response.headers["X-Audio-Duration"] = str(duration)
        response.headers["X-Sample-Rate"] = str(SAMPLE_RATE)
        return response

    except Exception as e:
        print(f"Error generating speech: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Chatterbox TTS server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
