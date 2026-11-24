#!/usr/bin/env python3
"""
AYVU Brain - Motor 100% offline de transcricao e diarizacao (Voz 1, Voz 2, Voz 3...)
Usa faster-whisper (int8 leve) + separacao de canal (L=microfone, R=sistema) + agrupamento acustico MFCC.
Zero API key, zero nuvem, zero token externo.
"""
import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
import wave

import imageio_ffmpeg
import numpy as np
from faster_whisper import WhisperModel
from scipy.cluster.hierarchy import fcluster, linkage
from scipy.fftpack import dct
from scipy.spatial.distance import pdist


def extract_wav(input_path, output_path, channel=None):
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [ffmpeg, "-y", "-i", input_path, "-vn", "-ar", "16000", "-acodec", "pcm_s16le"]
    if channel == "left":
        cmd += ["-af", "pan=mono|c0=FL"]
    elif channel == "right":
        cmd += ["-af", "pan=mono|c0=FR"]
    else:
        cmd += ["-ac", "1"]
    cmd.append(output_path)
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        raise RuntimeError(res.stderr.decode("utf-8", errors="ignore")[-400:] or "ffmpeg failed")


def read_wav_float(wav_path):
    with wave.open(wav_path, "rb") as wf:
        sr = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)
    audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    return audio, sr


def rms_energy(audio):
    if audio.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(audio * audio)))


def compute_voice_embedding(segment_audio, sr=16000):
    """Extrai assinatura acustica leve (MFCC + deltas + energia espectral + pitch proxy) para separar vozes."""
    if segment_audio.size < int(sr * 0.25):
        return None
    # Pre-enfase
    y = np.append(segment_audio[0], segment_audio[1:] - 0.97 * segment_audio[:-1])
    frame_len = int(0.025 * sr)
    hop = int(0.010 * sr)
    if y.size < frame_len:
        return None
    n_frames = 1 + (y.size - frame_len) // hop
    if n_frames < 3:
        return None

    indices = np.tile(np.arange(0, frame_len), (n_frames, 1)) + np.tile(
        np.arange(0, n_frames * hop, hop), (frame_len, 1)
    ).T
    frames = y[indices] * np.hamming(frame_len)
    nfft = 512
    mag = np.abs(np.fft.rfft(frames, nfft))
    pow_spec = (1.0 / nfft) * (mag ** 2)

    # Filterbank Mel (26 bandas entre 80 Hz e 7600 Hz)
    nfilt = 26
    low_mel = 2595.0 * np.log10(1.0 + 80.0 / 700.0)
    high_mel = 2595.0 * np.log10(1.0 + 7600.0 / 700.0)
    mel_pts = np.linspace(low_mel, high_mel, nfilt + 2)
    hz_pts = 700.0 * (10.0 ** (mel_pts / 2595.0) - 1.0)
    bins = np.floor((nfft + 1) * hz_pts / sr).astype(int)

    fbank = np.zeros((nfilt, nfft // 2 + 1), dtype=np.float32)
    for m in range(1, nfilt + 1):
        f_left, f_center, f_right = bins[m - 1], bins[m], bins[m + 1]
        for k in range(f_left, f_center):
            if f_center > f_left:
                fbank[m - 1, k] = (k - f_left) / (f_center - f_left)
        for k in range(f_center, f_right):
            if f_right > f_center:
                fbank[m - 1, k] = (f_right - k) / (f_right - f_center)

    filter_energies = np.dot(pow_spec, fbank.T)
    filter_energies = np.where(filter_energies <= 1e-10, 1e-10, filter_energies)
    log_mel = np.log(filter_energies)
    mfcc = dct(log_mel, type=2, axis=1, norm="ortho")[:, 1:14]

    # Filtra frames de silencio
    frame_energy = np.mean(frames ** 2, axis=1)
    thr = np.percentile(frame_energy, 30)
    active = mfcc[frame_energy >= thr]
    if active.shape[0] < 2:
        active = mfcc

    # Pitch proxy (centroide espectral normalizado)
    freqs = np.linspace(0, sr / 2.0, nfft // 2 + 1)
    centroid = np.sum(mag * freqs, axis=1) / (np.sum(mag, axis=1) + 1e-8)
    cent_mean = float(np.mean(centroid)) / 4000.0

    feat = np.concatenate([np.mean(active, axis=0), np.std(active, axis=0) * 0.5, [cent_mean]])
    norm = np.linalg.norm(feat)
    return feat / norm if norm > 1e-8 else feat


def cluster_speakers(segments, audio, sr, start_voice_index=1, max_speakers=6):
    """Agrupa segmentos acusticamente em Voz N, Voz N+1... sem precisar de token externo."""
    if not segments:
        return segments
    if len(segments) == 1:
        segments[0]["voiceId"] = f"Voz {start_voice_index}"
        segments[0]["speaker"] = f"Voz {start_voice_index}"
        return segments

    embs = []
    valid_idx = []
    for idx, seg in enumerate(segments):
        s_i = max(0, int(seg["start"] * sr))
        e_i = min(audio.size, int(seg["end"] * sr))
        emb = compute_voice_embedding(audio[s_i:e_i], sr)
        if emb is not None:
            embs.append(emb)
            valid_idx.append(idx)

    if len(embs) < 2:
        for seg in segments:
            seg["voiceId"] = f"Voz {start_voice_index}"
            seg["speaker"] = f"Voz {start_voice_index}"
        return segments

    mat = np.vstack(embs)
    dists = pdist(mat, metric="cosine")
    if np.all(np.isnan(dists)) or np.max(dists) < 0.14:
        labels = np.ones(len(embs), dtype=int)
    else:
        dists = np.nan_to_num(dists, nan=0.0)
        Z = linkage(dists, method="average")
        # Threshold calibrado para separar timbres distintos sem fragmentar demais
        labels = fcluster(Z, t=0.22, criterion="distance")
        if len(set(labels)) > max_speakers:
            labels = fcluster(Z, t=max_speakers, criterion="maxclust")

    # Renumera na ordem em que cada voz aparece na reuniao
    remap = {}
    next_id = start_voice_index
    assigned = {}
    for pos, seg_idx in enumerate(valid_idx):
        raw_lbl = int(labels[pos])
        if raw_lbl not in remap:
            remap[raw_lbl] = next_id
            next_id += 1
        assigned[seg_idx] = remap[raw_lbl]

    last_voice = start_voice_index
    for idx, seg in enumerate(segments):
        v = assigned.get(idx, last_voice)
        last_voice = v
        seg["voiceId"] = f"Voz {v}"
        seg["speaker"] = f"Voz {v}"
    return segments


def format_clock(sec):
    s = max(0, int(math.floor(sec)))
    return f"{s // 60:02d}:{s % 60:02d}"


def transcribe_wav(model, wav_path, language):
    lang_arg = None if not language or language == "auto" else language.split("-")[0].lower()
    raw_segs, info = model.transcribe(
        wav_path,
        language=lang_arg,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 450},
        beam_size=2,
    )
    out = []
    for seg in raw_segs:
        txt = (seg.text or "").strip()
        if not txt:
            continue
        out.append({
            "start": round(float(seg.start), 2),
            "end": round(float(seg.end), 2),
            "time": format_clock(seg.start),
            "text": txt,
        })
    return out, getattr(info, "language", lang_arg or "pt")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--language", default="pt")
    parser.add_argument("--model", default="small")
    parser.add_argument("--dual-channel", action="store_true")
    args = parser.parse_args()

    model_dir = os.environ.get("AYVU_WHISPER_CACHE") or os.path.join(
        os.environ.get("LOCALAPPDATA", tempfile.gettempdir()), "AYVU Brain", "models"
    )
    os.makedirs(model_dir, exist_ok=True)
    model = WhisperModel(args.model, device="cpu", compute_type="int8", download_root=model_dir)

    all_segments = []
    detected_lang = args.language

    with tempfile.TemporaryDirectory(prefix="ayvu-transcribe-") as tmp:
        if args.dual_channel:
            left_wav = os.path.join(tmp, "left.wav")
            right_wav = os.path.join(tmp, "right.wav")
            extract_wav(args.input, left_wav, "left")
            extract_wav(args.input, right_wav, "right")
            left_audio, sr_l = read_wav_float(left_wav)
            right_audio, sr_r = read_wav_float(right_wav)

            has_left = rms_energy(left_audio) > 0.002
            has_right = rms_energy(right_audio) > 0.002

            next_voice = 1
            if has_left:
                l_segs, detected_lang = transcribe_wav(model, left_wav, args.language)
                for s in l_segs:
                    s["voiceId"] = "Voz 1"
                    s["speaker"] = "Voz 1"
                    s["channel"] = "mic"
                all_segments.extend(l_segs)
                if l_segs:
                    next_voice = 2

            if has_right:
                r_segs, detected_lang = transcribe_wav(model, right_wav, args.language)
                cluster_speakers(r_segs, right_audio, sr_r, start_voice_index=next_voice)
                for s in r_segs:
                    s["channel"] = "system"
                all_segments.extend(r_segs)
        else:
            mono_wav = os.path.join(tmp, "mono.wav")
            extract_wav(args.input, mono_wav, None)
            mono_audio, sr_m = read_wav_float(mono_wav)
            segs, detected_lang = transcribe_wav(model, mono_wav, args.language)
            cluster_speakers(segs, mono_audio, sr_m, start_voice_index=1)
            all_segments.extend(segs)

    all_segments.sort(key=lambda x: (x["start"], x["end"]))

    # Mescla falas consecutivas curtas da mesma voz (< 1.2s de pausa) para leitura natural
    merged = []
    for seg in all_segments:
        if (
            merged
            and merged[-1]["voiceId"] == seg["voiceId"]
            and (seg["start"] - merged[-1]["end"]) <= 1.2
            and len(merged[-1]["text"]) < 320
        ):
            merged[-1]["text"] = f"{merged[-1]['text']} {seg['text']}".strip()
            merged[-1]["end"] = max(merged[-1]["end"], seg["end"])
        else:
            seg["id"] = f"seg-{len(merged) + 1}"
            merged.append(seg)

    voices = []
    seen = set()
    for seg in merged:
        vid = seg["voiceId"]
        if vid not in seen:
            seen.add(vid)
            voices.append({"voiceId": vid, "name": seg["speaker"], "channel": seg.get("channel", "mixed")})

    print(json.dumps({
        "ok": True,
        "engine": f"faster-whisper-{args.model}-offline",
        "language": detected_lang,
        "voices": voices,
        "transcript": merged,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
