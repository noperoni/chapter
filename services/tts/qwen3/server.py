#!/usr/bin/env python3
"""
Qwen3-TTS HTTP Service — standardized wrapper for TTS Model Manager.
Wraps Qwen/Qwen3-TTS-12Hz (0.6B or 1.7B via MODEL_SIZE env).
Exposes /health, /voices, /synthesize with the standard contract.
"""

import io
import os
import wave
import numpy as np
import torch
import soundfile as sf
from flask import Flask, request, jsonify, send_file
from qwen_tts import Qwen3TTSModel

app = Flask(__name__)

MODEL_SIZE = os.environ.get("MODEL_SIZE", "1.7b")
SAMPLE_RATE = 24000
DEFAULT_VOICE = "default"

MODEL_MAP = {
    "0.6b": "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
    "1.7b": "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
}

model_name = MODEL_MAP.get(MODEL_SIZE, MODEL_MAP["1.7b"])
MODEL_LABEL = f"qwen3-tts{'- small' if MODEL_SIZE == '0.6b' else ''}"

print(f"Loading Qwen3-TTS model: {model_name} ...")
model = Qwen3TTSModel.from_pretrained(
    model_name,
    device_map="cuda:0",
    dtype=torch.bfloat16,
)
print("Qwen3-TTS model loaded successfully!")

# CustomVoice model includes 9 premium timbres
VOICES = [
    {"id": "default", "name": "Default", "gender": "neutral", "language": "multi"},
    {"id": "male_young_cn", "name": "Young Male (CN)", "gender": "male", "language": "zh"},
    {"id": "female_young_cn", "name": "Young Female (CN)", "gender": "female", "language": "zh"},
    {"id": "male_young_en", "name": "Young Male (EN)", "gender": "male", "language": "en"},
    {"id": "female_young_en", "name": "Young Female (EN)", "gender": "female", "language": "en"},
]

VALID_VOICE_IDS = {v["id"] for v in VOICES}


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL_LABEL.replace(" ", "")})


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
        speed = float(data.get("speed", 1.0))

        # Generate speech via Qwen3-TTS
        # The CustomVoice model accepts text instructions for voice style
        audio_array = model.generate(
            text=text,
            speed=speed,
        )

        # audio_array is a numpy array at 24kHz
        if isinstance(audio_array, torch.Tensor):
            audio_array = audio_array.cpu().numpy()

        if audio_array.ndim > 1:
            audio_array = audio_array.squeeze()

        # Normalize to int16
        if audio_array.dtype == np.float32 or audio_array.dtype == np.float64:
            audio_int16 = (audio_array * 32767).astype(np.int16)
        else:
            audio_int16 = audio_array.astype(np.int16)

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
    print(f"Starting Qwen3-TTS server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
