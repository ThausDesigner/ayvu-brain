import { promises as fs } from 'node:fs';
import { join, resolve, relative, isAbsolute, extname } from 'node:path';

function recordingsDir(vaultRoot) {
  return resolve(vaultRoot, '_sessions', 'recordings');
}

export function sanitizeRecordingId(raw) {
  const clean = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  if (!clean) throw new Error('Invalid recording ID.');
  return clean;
}

function safeRecordingPaths(vaultRoot, id, ext = '.webm') {
  const cleanId = sanitizeRecordingId(id);
  const base = recordingsDir(vaultRoot);
  const metaPath = resolve(base, `${cleanId}.json`);
  const mediaPath = resolve(base, `${cleanId}${ext}`);
  for (const p of [metaPath, mediaPath]) {
    const rel = relative(base, p);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Recording path escapes directory.');
  }
  return { id: cleanId, base, metaPath, mediaPath };
}

export async function listRecordings(vaultRoot) {
  const dir = recordingsDir(vaultRoot);
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return []; }
  const items = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      const meta = JSON.parse(await fs.readFile(join(dir, entry.name), 'utf8'));
      items.push({
        id: meta.id,
        title: meta.title || 'Reunião',
        filename: meta.filename || `${meta.id}.webm`,
        mimeType: meta.mimeType || 'video/webm',
        size: Number(meta.size || 0),
        duration: meta.duration || '00:00',
        participants: Array.isArray(meta.participants) ? meta.participants : [],
        transcriptCount: Array.isArray(meta.transcript) ? meta.transcript.length : 0,
        createdAt: meta.createdAt || new Date().toISOString(),
        url: `/api/recordings/${encodeURIComponent(meta.id)}`
      });
    } catch {}
  }
  return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function saveRecording(vaultRoot, input) {
  if (!input?.dataBase64 || typeof input.dataBase64 !== 'string') {
    throw new Error('Recording binary data is required.');
  }
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const rawId = input.id || `rec-${day}-${Date.now().toString(36)}`;
  const mimeType = String(input.mimeType || 'video/webm').split(';')[0];
  const ext = mimeType.includes('mp4') ? '.mp4' : mimeType.includes('mpeg') || mimeType.includes('mp3') ? '.mp3' : mimeType.includes('wav') ? '.wav' : '.webm';
  const { id, base, metaPath, mediaPath } = safeRecordingPaths(vaultRoot, rawId, ext);
  await fs.mkdir(base, { recursive: true });

  const buffer = Buffer.from(input.dataBase64, 'base64');
  await fs.writeFile(mediaPath, buffer);

  const meta = {
    id,
    title: String(input.title || '').trim() || `Reunião ${day}`,
    filename: `${id}${ext}`,
    ext,
    mimeType,
    size: buffer.length,
    duration: String(input.duration || '00:00'),
    dualChannel: Boolean(input.dualChannel),
    voices: Array.isArray(input.voices) ? input.voices : [],
    participants: Array.isArray(input.participants) ? input.participants.map(String) : [],
    transcript: Array.isArray(input.transcript) ? input.transcript : [],
    notes: String(input.notes || ''),
    createdAt: now,
    relPath: `_sessions/recordings/${id}${ext}`,
    url: `/api/recordings/${encodeURIComponent(id)}`
  };
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  return meta;
}

export async function updateRecordingMeta(vaultRoot, id, patch) {
  const { metaPath } = safeRecordingPaths(vaultRoot, id);
  const current = JSON.parse(await fs.readFile(metaPath, 'utf8'));
  const updated = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: new Date().toISOString()
  };
  await fs.writeFile(metaPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  return updated;
}

export async function renameRecordingVoices(vaultRoot, id, voiceMap) {
  const { metaPath } = safeRecordingPaths(vaultRoot, id);
  const current = JSON.parse(await fs.readFile(metaPath, 'utf8'));
  const map = (voiceMap && typeof voiceMap === 'object') ? voiceMap : {};
  const transcript = (Array.isArray(current.transcript) ? current.transcript : []).map(seg => {
    const vid = seg.voiceId || seg.speaker || 'Voz 1';
    const nextName = String(map[vid] || '').trim() || seg.speaker || vid;
    return { ...seg, voiceId: vid, speaker: nextName };
  });
  const voices = (Array.isArray(current.voices) ? current.voices : []).map(v => {
    const nextName = String(map[v.voiceId] || '').trim() || v.name || v.voiceId;
    return { ...v, name: nextName };
  });
  const participants = [...new Set(transcript.map(s => s.speaker).filter(Boolean))];
  const updated = {
    ...current,
    voices,
    participants,
    transcript,
    updatedAt: new Date().toISOString()
  };
  await fs.writeFile(metaPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  return updated;
}

export async function getRecordingFilePath(vaultRoot, id) {
  const meta = await getRecordingMeta(vaultRoot, id);
  const ext = meta.ext || extname(meta.filename || '.webm') || '.webm';
  const { mediaPath } = safeRecordingPaths(vaultRoot, id, ext);
  return { mediaPath, meta };
}

export async function getRecordingMeta(vaultRoot, id) {
  const { metaPath } = safeRecordingPaths(vaultRoot, id);
  return JSON.parse(await fs.readFile(metaPath, 'utf8'));
}

export async function readRecordingFile(vaultRoot, id) {
  const meta = await getRecordingMeta(vaultRoot, id);
  const ext = meta.ext || extname(meta.filename || '.webm') || '.webm';
  const { mediaPath } = safeRecordingPaths(vaultRoot, id, ext);
  const buffer = await fs.readFile(mediaPath);
  return { buffer, meta };
}

export async function deleteRecording(vaultRoot, id) {
  const cleanId = sanitizeRecordingId(id);
  const base = recordingsDir(vaultRoot);
  const metaPath = resolve(base, `${cleanId}.json`);
  let ext = '.webm';
  try {
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    if (meta.ext) ext = meta.ext;
  } catch {}
  const { mediaPath } = safeRecordingPaths(vaultRoot, cleanId, ext);
  await fs.rm(metaPath, { force: true });
  await fs.rm(mediaPath, { force: true });
  return { ok: true, id: cleanId };
}

export async function deleteRecordingsBulk(vaultRoot, ids) {
  const list = Array.isArray(ids) ? ids : [];
  const removed = [];
  for (const id of list) {
    try {
      const r = await deleteRecording(vaultRoot, id);
      removed.push(r.id);
    } catch {}
  }
  return { ok: true, removed, count: removed.length };
}
