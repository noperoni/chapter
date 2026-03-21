#!/usr/bin/env python3
"""
Kokoro TTS HTTP Service — standardized wrapper for TTS Model Manager.
Exposes /health, /voices, /synthesize with the standard contract.
"""

import io
import os
import wave
import numpy as np
from flask import Flask, request, jsonify, send_file
from kokoro_onnx import Kokoro

app = Flask(__name__)

# Initialize Kokoro TTS (loaded once at startup)
print("Loading Kokoro TTS model...")
model_path = os.path.expanduser("~/.cache/kokoro/kokoro-v1.0.onnx")
voices_path = os.path.expanduser("~/.cache/kokoro/voices.bin")
kokoro = Kokoro(model_path, voices_path)
print("Kokoro TTS model loaded successfully!")

DEFAULT_SPEED = 1.0
DEFAULT_VOICE = 'af_heart'

# All 55 Kokoro v1.0 voices with metadata
VOICES = [
    # American English — Female (11)
    {"id": "af_heart", "name": "Heart", "gender": "female", "language": "en-US"},
    {"id": "af_alloy", "name": "Alloy", "gender": "female", "language": "en-US"},
    {"id": "af_aoede", "name": "Aoede", "gender": "female", "language": "en-US"},
    {"id": "af_bella", "name": "Bella", "gender": "female", "language": "en-US"},
    {"id": "af_jessica", "name": "Jessica", "gender": "female", "language": "en-US"},
    {"id": "af_kore", "name": "Kore", "gender": "female", "language": "en-US"},
    {"id": "af_nicole", "name": "Nicole", "gender": "female", "language": "en-US"},
    {"id": "af_nova", "name": "Nova", "gender": "female", "language": "en-US"},
    {"id": "af_river", "name": "River", "gender": "female", "language": "en-US"},
    {"id": "af_sarah", "name": "Sarah", "gender": "female", "language": "en-US"},
    {"id": "af_sky", "name": "Sky", "gender": "female", "language": "en-US"},
    # American English — Male (9)
    {"id": "am_adam", "name": "Adam", "gender": "male", "language": "en-US"},
    {"id": "am_echo", "name": "Echo", "gender": "male", "language": "en-US"},
    {"id": "am_eric", "name": "Eric", "gender": "male", "language": "en-US"},
    {"id": "am_fenrir", "name": "Fenrir", "gender": "male", "language": "en-US"},
    {"id": "am_liam", "name": "Liam", "gender": "male", "language": "en-US"},
    {"id": "am_michael", "name": "Michael", "gender": "male", "language": "en-US"},
    {"id": "am_onyx", "name": "Onyx", "gender": "male", "language": "en-US"},
    {"id": "am_puck", "name": "Puck", "gender": "male", "language": "en-US"},
    {"id": "am_santa", "name": "Santa", "gender": "male", "language": "en-US"},
    # British English — Female (4)
    {"id": "bf_alice", "name": "Alice", "gender": "female", "language": "en-GB"},
    {"id": "bf_emma", "name": "Emma", "gender": "female", "language": "en-GB"},
    {"id": "bf_isabella", "name": "Isabella", "gender": "female", "language": "en-GB"},
    {"id": "bf_lily", "name": "Lily", "gender": "female", "language": "en-GB"},
    # British English — Male (4)
    {"id": "bm_daniel", "name": "Daniel", "gender": "male", "language": "en-GB"},
    {"id": "bm_fable", "name": "Fable", "gender": "male", "language": "en-GB"},
    {"id": "bm_george", "name": "George", "gender": "male", "language": "en-GB"},
    {"id": "bm_lewis", "name": "Lewis", "gender": "male", "language": "en-GB"},
    # Japanese (5)
    {"id": "jf_alpha", "name": "Alpha", "gender": "female", "language": "ja"},
    {"id": "jf_gongitsune", "name": "Gongitsune", "gender": "female", "language": "ja"},
    {"id": "jf_nezumi", "name": "Nezumi", "gender": "female", "language": "ja"},
    {"id": "jf_tebukuro", "name": "Tebukuro", "gender": "female", "language": "ja"},
    {"id": "jm_kumo", "name": "Kumo", "gender": "male", "language": "ja"},
    # Mandarin Chinese (8)
    {"id": "zf_xiaobei", "name": "Xiaobei", "gender": "female", "language": "zh"},
    {"id": "zf_xiaoni", "name": "Xiaoni", "gender": "female", "language": "zh"},
    {"id": "zf_xiaoxiao", "name": "Xiaoxiao", "gender": "female", "language": "zh"},
    {"id": "zf_xiaoyi", "name": "Xiaoyi", "gender": "female", "language": "zh"},
    {"id": "zm_yunjian", "name": "Yunjian", "gender": "male", "language": "zh"},
    {"id": "zm_yunxi", "name": "Yunxi", "gender": "male", "language": "zh"},
    {"id": "zm_yunxia", "name": "Yunxia", "gender": "male", "language": "zh"},
    {"id": "zm_yunyang", "name": "Yunyang", "gender": "male", "language": "zh"},
    # Spanish (3)
    {"id": "ef_dora", "name": "Dora", "gender": "female", "language": "es"},
    {"id": "em_alex", "name": "Alex", "gender": "male", "language": "es"},
    {"id": "em_santa", "name": "Santa", "gender": "male", "language": "es"},
    # French (1)
    {"id": "ff_siwis", "name": "Siwis", "gender": "female", "language": "fr"},
    # Hindi (4)
    {"id": "hf_alpha", "name": "Alpha", "gender": "female", "language": "hi"},
    {"id": "hf_beta", "name": "Beta", "gender": "female", "language": "hi"},
    {"id": "hm_omega", "name": "Omega", "gender": "male", "language": "hi"},
    {"id": "hm_psi", "name": "Psi", "gender": "male", "language": "hi"},
    # Italian (2)
    {"id": "if_sara", "name": "Sara", "gender": "female", "language": "it"},
    {"id": "im_nicola", "name": "Nicola", "gender": "male", "language": "it"},
    # Brazilian Portuguese (3)
    {"id": "pf_dora", "name": "Dora", "gender": "female", "language": "pt-BR"},
    {"id": "pm_alex", "name": "Alex", "gender": "male", "language": "pt-BR"},
    {"id": "pm_santa", "name": "Santa", "gender": "male", "language": "pt-BR"},
]

VALID_VOICE_IDS = {v["id"] for v in VOICES}


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "model": "kokoro"})


@app.route('/voices', methods=['GET'])
def voices():
    return jsonify(VOICES)


@app.route('/synthesize', methods=['POST'])
def synthesize():
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"error": "Missing required field: text"}), 400

        text = data['text']
        voice = data.get('voice', DEFAULT_VOICE)
        speed = float(data.get('speed', DEFAULT_SPEED))

        if voice not in VALID_VOICE_IDS:
            return jsonify({"error": f"Invalid voice: {voice}"}), 400

        audio, sample_rate = kokoro.create(text, voice=voice, speed=speed)

        audio_int16 = (audio * 32767).astype(np.int16)

        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(audio_int16.tobytes())
        wav_buffer.seek(0)

        duration = len(audio) / sample_rate

        response = send_file(
            wav_buffer,
            mimetype='audio/wav',
            as_attachment=False,
            download_name='speech.wav'
        )
        response.headers['X-Audio-Duration'] = str(duration)
        response.headers['X-Sample-Rate'] = str(sample_rate)
        return response

    except Exception as e:
        print(f"Error generating speech: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting Kokoro TTS server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
