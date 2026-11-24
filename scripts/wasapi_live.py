#!/usr/bin/env python3
"""
AYVU Brain - Captura nativa de audio do sistema no Windows (WASAPI Loopback)
+ transcricao e separacao de vozes (Voz 2, Voz 3, Voz 4...) em tempo real 100% offline.

Captura simultaneamente todos os dispositivos de saida ativos (ex: fone Bluetooth Stereo,
Headset Hands-Free AG Audio usado por Slack/Meet/Zoom, e alto-falantes), garantindo que
vozes de chamadas no Slack/Teams/Discord sejam sempre captadas sem depender do navegador.
"""
import argparse
import json
import os
import sys
import tempfile
import threading
import time
import wave

import numpy as np
import pyaudiowpatch as pa
from faster_whisper import WhisperModel

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from transcribe_diarize import compute_voice_embedding, format_clock, rms_energy
from transcribe_worker import SpeakerTracker

TARGET_SR = 16000


def resample_to_16k(mono_f32, src_sr):
    if mono_f32.size == 0 or src_sr == TARGET_SR:
        return mono_f32.astype(np.float32, copy=False)
    dst_len = max(1, int(round(mono_f32.size * TARGET_SR / float(src_sr))))
    x_old = np.linspace(0.0, 1.0, num=mono_f32.size, endpoint=False)
    x_new = np.linspace(0.0, 1.0, num=dst_len, endpoint=False)
    return np.interp(x_new, x_old, mono_f32).astype(np.float32)


class LoopbackDeviceReader:
    def __init__(self, p_audio, dev_info):
        self.p_audio = p_audio
        self.dev = dev_info
        self.name = dev_info["name"]
        self.sr = int(round(dev_info["defaultSampleRate"]))
        self.channels = max(1, int(dev_info["maxInputChannels"]))
        self.lock = threading.Lock()
        self.chunks = []
        self.stream = None

    def _callback(self, in_data, frame_count, time_info, status):
        arr = np.frombuffer(in_data, dtype=np.int16).astype(np.float32) / 32768.0
        if self.channels > 1:
            arr = arr.reshape(-1, self.channels).mean(axis=1)
        arr16 = resample_to_16k(arr, self.sr)
        with self.lock:
            self.chunks.append(arr16)
        return (None, pa.paContinue)

    def start(self):
        self.stream = self.p_audio.open(
            format=pa.paInt16,
            channels=self.channels,
            rate=self.sr,
            frames_per_buffer=max(512, int(self.sr * 0.05)),
            input=True,
            input_device_index=self.dev["index"],
            stream_callback=self._callback,
        )
        self.stream.start_stream()

    def drain(self):
        with self.lock:
            if not self.chunks:
                return np.zeros(0, dtype=np.float32)
            out = np.concatenate(self.chunks)
            self.chunks = []
            return out

    def stop(self):
        if self.stream is not None:
            try:
                self.stream.stop_stream()
                self.stream.close()
            except Exception:
                pass
            self.stream = None


def emit(obj):
    print(json.dumps(obj, ensure_ascii=False), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--language", default="pt")
    parser.add_argument("--model", default="base")
    parser.add_argument("--chunk-sec", type=float, default=4.5)
    parser.add_argument("--out-wav", default="")
    args = parser.parse_args()

    lang_arg = None if not args.language or args.language == "auto" else args.language.split("-")[0].lower()
    model_dir = os.environ.get("AYVU_WHISPER_CACHE") or os.path.join(
        os.environ.get("LOCALAPPDATA", tempfile.gettempdir()), "AYVU Brain", "models"
    )
    os.makedirs(model_dir, exist_ok=True)
    model = WhisperModel(args.model, device="cpu", compute_type="int8", download_root=model_dir)

    p_audio = pa.PyAudio()
    readers = []
    started_names = []
    try:
        for dev in p_audio.get_loopback_device_info_generator():
            r = LoopbackDeviceReader(p_audio, dev)
            try:
                r.start()
                readers.append(r)
                started_names.append(r.name)
            except Exception:
                r.stop()
    except Exception as err:
        emit({"type": "error", "error": f"Falha ao enumerar WASAPI loopback: {err}"})
        p_audio.terminate()
        sys.exit(1)

    if not readers:
        emit({"type": "error", "error": "Nenhum dispositivo WASAPI Loopback disponivel."})
        p_audio.terminate()
        sys.exit(1)

    stop_event = threading.Event()

    def stdin_watcher():
        try:
            for line in sys.stdin:
                s = line.strip()
                if not s:
                    continue
                try:
                    msg = json.loads(s)
                    if msg.get("cmd") == "stop":
                        stop_event.set()
                        return
                except Exception:
                    if s.lower() == "stop":
                        stop_event.set()
                        return
        except Exception:
            pass
        stop_event.set()

    t_in = threading.Thread(target=stdin_watcher, daemon=True)
    t_in.start()

    wav_writer = None
    if args.out_wav:
        os.makedirs(os.path.dirname(os.path.abspath(args.out_wav)), exist_ok=True)
        wav_writer = wave.open(args.out_wav, "wb")
        wav_writer.setnchannels(1)
        wav_writer.setsampwidth(2)
        wav_writer.setframerate(TARGET_SR)

    tracker = SpeakerTracker(start_index=2, threshold=0.26, max_voices=6)
    start_ts = time.monotonic()
    emit({"type": "ready", "ready": True, "devices": started_names, "model": args.model})

    def process_window(window_offset):
        best_audio = None
        best_rms = 0.0
        for r in readers:
            buf = r.drain()
            if buf.size < 1600:
                continue
            e = rms_energy(buf)
            if e > best_rms:
                best_rms = e
                best_audio = buf

        if best_audio is None:
            return

        if wav_writer is not None:
            pcm16 = np.clip(best_audio * 32767.0, -32768, 32767).astype(np.int16)
            wav_writer.writeframes(pcm16.tobytes())

        if best_rms <= 0.0020:
            return

        raw_segs, _ = model.transcribe(
            best_audio,
            language=lang_arg,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 400},
            beam_size=2,
        )
        segs = []
        for seg in raw_segs:
            txt = (seg.text or "").strip()
            if not txt:
                continue
            s_i = max(0, int(seg.start * TARGET_SR))
            e_i = min(best_audio.size, int(seg.end * TARGET_SR))
            emb = compute_voice_embedding(best_audio[s_i:e_i], TARGET_SR)
            vid = tracker.assign(emb)
            abs_start = round(window_offset + float(seg.start), 2)
            abs_end = round(window_offset + float(seg.end), 2)
            segs.append({
                "start": abs_start,
                "end": abs_end,
                "time": format_clock(abs_start),
                "voiceId": vid,
                "speaker": vid,
                "channel": "system",
                "text": txt,
            })

        if segs:
            emit({"type": "segments", "segments": segs})

    try:
        while not stop_event.is_set():
            window_offset = max(0.0, time.monotonic() - start_ts)
            stop_event.wait(timeout=args.chunk_sec)
            process_window(window_offset)
    finally:
        for r in readers:
            r.stop()
        if wav_writer is not None:
            try:
                wav_writer.close()
            except Exception:
                pass
        p_audio.terminate()
        emit({"type": "stopped", "wavPath": args.out_wav or ""})


if __name__ == "__main__":
    main()
