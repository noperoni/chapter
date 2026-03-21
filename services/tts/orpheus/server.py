#!/usr/bin/env python3
"""
Orpheus TTS HTTP Service — standardized wrapper for TTS Model Manager.
Wraps canopylabs/orpheus-tts-0.1-finetune-prod (3B) via orpheus-speech.
Exposes /health, /voices, /synthesize with the standard contract.
"""

import io
import os
import wave
from flask import Flask, request, jsonify, send_file
from orpheus_tts import OrpheusModel

app = Flask(__name__)

MODEL_NAME = os.environ.get(
    "ORPHEUS_MODEL", "canopylabs/orpheus-tts-0.1-finetune-prod"
)
MAX_MODEL_LEN = int(os.environ.get("MAX_MODEL_LEN", "2048"))
DEFAULT_VOICE = "tara"
SAMPLE_RATE = 24000

print(f"Loading Orpheus TTS model: {MODEL_NAME} ...")
model = OrpheusModel(model_name=MODEL_NAME, max_model_len=MAX_MODEL_LEN)
print("Orpheus TTS model loaded successfully!")

VOICES = [
    {"id": "tara", "name": "Tara", "gender": "female", "language": "en"},
    {"id": "leah", "name": "Leah", "gender": "female", "language": "en"},
    {"id": "jess", "name": "Jess", "gender": "female", "language": "en"},
    {"id": "mia", "name": "Mia", "gender": "female", "language": "en"},
    {"id": "zoe", "name": "Zoe", "gender": "female", "language": "en"},
    {"id": "leo", "name": "Leo", "gender": "male", "language": "en"},
    {"id": "dan", "name": "Dan", "gender": "male", "language": "en"},
    {"id": "zac", "name": "Zac", "gender": "male", "language": "en"},
]

VALID_VOICE_IDS = {v["id"] for v in VOICES}


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "orpheus-3b"})


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
        voice = data.get("voice", DEFAULT_VOICE)
        speed = float(data.get("speed", 1.0))

        if voice not in VALID_VOICE_IDS:
            return jsonify({"error": f"Invalid voice: {voice}"}), 400

        # Orpheus uses repetition_penalty to control speed/stability.
        # Higher values = faster speech. Map our 0.5-2.0 speed to 1.1-1.4 rep penalty.
        rep_penalty = 1.1 + (speed - 1.0) * 0.3

        syn_tokens = model.generate_speech(
            prompt=text,
            voice=voice,
            repetition_penalty=max(1.1, rep_penalty),
        )

        # Collect all audio chunks from the generator
        audio_frames = b""
        for chunk in syn_tokens:
            audio_frames += chunk

        if not audio_frames:
            return jsonify({"error": "No audio generated"}), 500

        # Wrap raw PCM in WAV container
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(audio_frames)
        wav_buffer.seek(0)

        duration = len(audio_frames) / (SAMPLE_RATE * 2)  # 2 bytes per sample

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
    print(f"Starting Orpheus TTS server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
