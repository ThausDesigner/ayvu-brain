#!/usr/bin/env python3
"""
AYVU Brain - Worker residente 100% offline para transcricao em tempo real (SO + Microfone)
Mantem o modelo faster-whisper carregado em memoria e rastreia centroides acusticos por reuniao
para manter Voz 1 (Mic), Voz 2, Voz 3, Voz 4... consistentes entre blocos de 5 segundos.
"""
import base64
import json
import math
import os
import sys
import tempfile

import numpy as np
from faster_whisper import WhisperModel

# Reaproveita extracao WAV e embedding acustico de transcribe_diarize.py
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from transcribe_diarize import compute_voice_embedding, extract_wav, format_clock, read_wav_float, rms_energy, transcribe_wav


def cosine_distance(a, b):
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom <= 1e-8:
        return 1.0
    return float(1.0 - np.dot(a, b) / denom)


class SpeakerTracker:
    def __init__(self, start_index=2, threshold=0.26, max_voices=6):
        self.start_index = start_index
        self.threshold = threshold
        self.max_voices = max_voices
        self.centroids = []  # list of (voice_id, embedding, count)

    def assign(self, emb):
        if emb is None:
            if self.centroids:
                return self.centroids[-1][0]
            vid = f"Voz {self.start_index}"
            return vid

        best_idx = -1
        best_dist = 999.0
        for idx, (vid, cent, count) in enumerate(self.centroids):
            d = cosine_distance(emb, cent)
            if d < best_dist:
                best_dist = d
                best_idx = idx

        if best_idx >= 0 and (best_dist <= self.threshold or len(self.centroids) >= self.max_voices):
            vid, cent, count = self.centroids[best_idx]
            new_cent = (cent * count + emb) / (count + 1)
            norm = np.linalg.norm(new_cent)
            if norm > 1e-8:
                new_cent = new_cent / norm
            self.centroids[best_idx] = (vid, new_cent, count + 1)
            return vid

        vid = f"Voz {self.start_index + len(self.centroids)}"
        self.centroids.append((vid, emb, 1))
        return vid


def main():
    model_name = os.environ.get("AYVU_LIVE_MODEL", "base")
    model_dir = os.environ.get("AYVU_WHISPER_CACHE") or os.path.join(
        os.environ.get("LOCALAPPDATA", tempfile.gettempdir()), "AYVU Brain", "models"
    )
    os.makedirs(model_dir, exist_ok=True)
    model = WhisperModel(model_name, device="cpu", compute_type="int8", download_root=model_dir)
    trackers = {}

    print(json.dumps({"ready": True, "model": model_name}), flush=True)

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        req_id = ""
        try:
            req = json.loads(line)
            req_id = req.get("id", "")
            cmd = req.get("cmd", "chunk")
            session_id = str(req.get("sessionId") or "default")

            if cmd == "reset":
                trackers.pop(session_id, None)
                print(json.dumps({"id": req_id, "ok": True}), flush=True)
                continue

            audio_b64 = req.get("dataBase64") or ""
            language = str(req.get("language") or "pt").split("-")[0].lower()
            dual_channel = bool(req.get("dualChannel", True))
            mic_only = bool(req.get("micOnly", False))
            offset_sec = float(req.get("offsetSec") or 0.0)

            if not audio_b64:
                print(json.dumps({"id": req_id, "ok": True, "segments": []}), flush=True)
                continue

            if session_id not in trackers:
                trackers[session_id] = SpeakerTracker(start_index=2 if dual_channel else 1)
            tracker = trackers[session_id]

            out_segments = []
            with tempfile.TemporaryDirectory(prefix="ayvu-live-") as tmp:
                in_path = os.path.join(tmp, "chunk.webm")
                with open(in_path, "wb") as f:
                    f.write(base64.b64decode(audio_b64))

                if dual_channel:
                    left_wav = os.path.join(tmp, "left.wav")
                    right_wav = os.path.join(tmp, "right.wav")
                    extract_wav(in_path, left_wav, "left")
                    extract_wav(in_path, right_wav, "right")
                    left_audio, sr_l = read_wav_float(left_wav)
                    right_audio, sr_r = read_wav_float(right_wav)

                    if rms_energy(left_audio) > 0.0025:
                        l_segs, _ = transcribe_wav(model, left_wav, language)
                        for s in l_segs:
                            abs_start = round(offset_sec + s["start"], 2)
                            abs_end = round(offset_sec + s["end"], 2)
                            out_segments.append({
                                "start": abs_start,
                                "end": abs_end,
                                "time": format_clock(abs_start),
                                "voiceId": "Voz 1",
                                "speaker": "Voz 1",
                                "channel": "mic",
                                "text": s["text"],
                            })

                    if (not mic_only) and rms_energy(right_audio) > 0.0025:
                        r_segs, _ = transcribe_wav(model, right_wav, language)
                        for s in r_segs:
                            s_i = max(0, int(s["start"] * sr_r))
                            e_i = min(right_audio.size, int(s["end"] * sr_r))
                            emb = compute_voice_embedding(right_audio[s_i:e_i], sr_r)
                            vid = tracker.assign(emb)
                            abs_start = round(offset_sec + s["start"], 2)
                            abs_end = round(offset_sec + s["end"], 2)
                            out_segments.append({
                                "start": abs_start,
                                "end": abs_end,
                                "time": format_clock(abs_start),
                                "voiceId": vid,
                                "speaker": vid,
                                "channel": "system",
                                "text": s["text"],
                            })
                else:
                    mono_wav = os.path.join(tmp, "mono.wav")
                    extract_wav(in_path, mono_wav, None)
                    mono_audio, sr_m = read_wav_float(mono_wav)
                    if rms_energy(mono_audio) > 0.0025:
                        m_segs, _ = transcribe_wav(model, mono_wav, language)
                        for s in m_segs:
                            s_i = max(0, int(s["start"] * sr_m))
                            e_i = min(mono_audio.size, int(s["end"] * sr_m))
                            emb = compute_voice_embedding(mono_audio[s_i:e_i], sr_m)
                            vid = tracker.assign(emb)
                            abs_start = round(offset_sec + s["start"], 2)
                            abs_end = round(offset_sec + s["end"], 2)
                            out_segments.append({
                                "start": abs_start,
                                "end": abs_end,
                                "time": format_clock(abs_start),
                                "voiceId": vid,
                                "speaker": vid,
                                "channel": "mixed",
                                "text": s["text"],
                            })

            out_segments.sort(key=lambda x: (x["start"], x["end"]))
            print(json.dumps({"id": req_id, "ok": True, "segments": out_segments}, ensure_ascii=False), flush=True)
        except Exception as err:
            print(json.dumps({"id": req_id, "ok": False, "error": str(err)}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
