import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));

export function getOfflineTranscriberPaths() {
  const localApp = process.env.LOCALAPPDATA || join(projectRoot, '.local');
  const baseDir = join(localApp, 'AYVU Brain', 'transcriber');
  const pythonBin = process.platform === 'win32'
    ? join(baseDir, 'venv', 'Scripts', 'python.exe')
    : join(baseDir, 'venv', 'bin', 'python');
  const scriptPath = join(projectRoot, 'scripts', 'transcribe_diarize.py');
  const workerScriptPath = join(projectRoot, 'scripts', 'transcribe_worker.py');
  const wasapiScriptPath = join(projectRoot, 'scripts', 'wasapi_live.py');
  return { baseDir, pythonBin, scriptPath, workerScriptPath, wasapiScriptPath };
}

export async function getOfflineTranscriberStatus() {
  const { pythonBin, scriptPath, workerScriptPath, wasapiScriptPath } = getOfflineTranscriberPaths();
  let pythonReady = false;
  let scriptReady = false;
  let liveWorkerReady = false;
  let wasapiReady = false;
  try { await fs.access(pythonBin); pythonReady = true; } catch {}
  try { await fs.access(scriptPath); scriptReady = true; } catch {}
  try { await fs.access(workerScriptPath); liveWorkerReady = true; } catch {}
  try { await fs.access(wasapiScriptPath); wasapiReady = process.platform === 'win32'; } catch {}
  return {
    ready: pythonReady && scriptReady,
    liveReady: pythonReady && liveWorkerReady,
    wasapiReady: pythonReady && wasapiReady,
    pythonReady,
    scriptReady,
    engine: 'faster-whisper-offline',
    pythonBin,
    scriptPath,
    workerScriptPath,
    wasapiScriptPath
  };
}

export function runOfflineTranscription({ inputPath, language = 'pt', dualChannel = false, model = 'small' }) {
  return new Promise(async (resolveRun, rejectRun) => {
    const status = await getOfflineTranscriberStatus();
    if (!status.ready) {
      rejectRun(new Error('Motor offline ainda não instalado em %LOCALAPPDATA%\\AYVU Brain\\transcriber.'));
      return;
    }

    const args = [
      status.scriptPath,
      '--input', inputPath,
      '--language', String(language || 'pt').split('-')[0].toLowerCase(),
      '--model', model
    ];
    if (dualChannel) args.push('--dual-channel');

    const child = spawn(status.pythonBin, args, {
      cwd: projectRoot,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      rejectRun(new Error('Transcrição offline excedeu o tempo limite (10 min).'));
    }, 600000);

    child.stdout.on('data', chunk => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); });
    child.on('error', err => { clearTimeout(timer); rejectRun(new Error(`Falha ao iniciar motor offline: ${err.message}`)); });
    child.on('close', code => {
      clearTimeout(timer);
      const cleanOut = stdout.trim();
      if (code !== 0) {
        rejectRun(new Error(stderr.trim().slice(-500) || `Motor offline encerrou com código ${code}.`));
        return;
      }
      try {
        const lastLine = cleanOut.split(/\r?\n/).reverse().find(l => l.trim().startsWith('{')) || cleanOut;
        const parsed = JSON.parse(lastLine);
        resolveRun(parsed);
      } catch {
        rejectRun(new Error('Saída inválida do motor offline: ' + cleanOut.slice(-300)));
      }
    });
  });
}

// --- Resident live transcription worker (OS + Mic real-time 100% offline) ---
const LIVE_IDLE_MS = 10 * 60 * 1000;
let liveWorker = null;
let liveReadyPromise = null;
let liveIdleTimer = null;
let liveSeq = 0;
let liveStdoutBuf = '';
let liveStderrTail = '';
const livePending = new Map();

function resetLiveIdleTimer() {
  if (liveIdleTimer) clearTimeout(liveIdleTimer);
  liveIdleTimer = setTimeout(() => {
    shutdownLiveWorker();
  }, LIVE_IDLE_MS);
  if (liveIdleTimer.unref) liveIdleTimer.unref();
}

export function shutdownLiveWorker() {
  if (liveIdleTimer) { clearTimeout(liveIdleTimer); liveIdleTimer = null; }
  if (liveWorker) {
    try { liveWorker.kill(); } catch {}
    liveWorker = null;
  }
  liveReadyPromise = null;
  liveStdoutBuf = '';
  for (const [, p] of livePending) {
    clearTimeout(p.timer);
    p.reject(new Error('Worker de transcrição ao vivo encerrado.'));
  }
  livePending.clear();
}

async function ensureLiveWorker() {
  if (liveWorker && liveReadyPromise) {
    resetLiveIdleTimer();
    await liveReadyPromise;
    return liveWorker;
  }

  const status = await getOfflineTranscriberStatus();
  if (!status.liveReady) {
    throw new Error('Worker offline em tempo real não instalado em %LOCALAPPDATA%\\AYVU Brain\\transcriber.');
  }

  liveStdoutBuf = '';
  liveStderrTail = '';
  const child = spawn(status.pythonBin, [status.workerScriptPath], {
    cwd: projectRoot,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }
  });
  liveWorker = child;

  liveReadyPromise = new Promise((resolveReady, rejectReady) => {
    let settled = false;
    const readyTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      shutdownLiveWorker();
      rejectReady(new Error('Tempo limite ao iniciar motor offline ao vivo (180s).'));
    }, 180000);

    child.stdout.on('data', chunk => {
      liveStdoutBuf += chunk.toString('utf8');
      let nl;
      while ((nl = liveStdoutBuf.indexOf('\n')) >= 0) {
        const line = liveStdoutBuf.slice(0, nl).trim();
        liveStdoutBuf = liveStdoutBuf.slice(nl + 1);
        if (!line || !line.startsWith('{')) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.ready && !settled) {
          settled = true;
          clearTimeout(readyTimer);
          resolveReady(msg);
          continue;
        }
        if (msg.id && livePending.has(msg.id)) {
          const entry = livePending.get(msg.id);
          livePending.delete(msg.id);
          clearTimeout(entry.timer);
          if (msg.ok === false) entry.reject(new Error(msg.error || 'Falha no bloco de transcrição.'));
          else entry.resolve(msg);
        }
      }
    });

    child.stderr.on('data', chunk => {
      liveStderrTail = (liveStderrTail + chunk.toString('utf8')).slice(-800);
    });

    child.on('error', err => {
      if (!settled) {
        settled = true;
        clearTimeout(readyTimer);
        rejectReady(new Error(`Falha ao iniciar worker ao vivo: ${err.message}`));
      }
      shutdownLiveWorker();
    });

    child.on('close', code => {
      if (!settled) {
        settled = true;
        clearTimeout(readyTimer);
        rejectReady(new Error(liveStderrTail.trim() || `Worker ao vivo encerrou com código ${code}.`));
      }
      if (liveWorker === child) {
        liveWorker = null;
        liveReadyPromise = null;
      }
      for (const [, p] of livePending) {
        clearTimeout(p.timer);
        p.reject(new Error('Worker ao vivo encerrou inesperadamente.'));
      }
      livePending.clear();
    });
  });

  resetLiveIdleTimer();
  await liveReadyPromise;
  return child;
}

async function sendLiveCommand(payload, timeoutMs = 45000) {
  const child = await ensureLiveWorker();
  resetLiveIdleTimer();
  const id = `live-${++liveSeq}`;
  return new Promise((resolveCmd, rejectCmd) => {
    const timer = setTimeout(() => {
      livePending.delete(id);
      rejectCmd(new Error('Tempo limite no bloco de transcrição ao vivo.'));
    }, timeoutMs);
    livePending.set(id, { resolve: resolveCmd, reject: rejectCmd, timer });
    try {
      child.stdin.write(JSON.stringify({ ...payload, id }) + '\n', 'utf8');
    } catch (err) {
      clearTimeout(timer);
      livePending.delete(id);
      rejectCmd(err);
    }
  });
}

export async function resetLiveTranscription(sessionId) {
  if (!liveWorker) return { ok: true };
  return sendLiveCommand({ cmd: 'reset', sessionId }, 10000);
}

export async function transcribeLiveChunk({ sessionId, dataBase64, offsetSec = 0, language = 'pt', dualChannel = true, micOnly = false }) {
  return sendLiveCommand({
    cmd: 'chunk',
    sessionId,
    dataBase64,
    offsetSec,
    language,
    dualChannel,
    micOnly
  }, 60000);
}

// --- Native Windows WASAPI Loopback capture (captures Slack/Meet/Zoom/Teams/OS audio directly) ---
const systemSessions = new Map();

export async function startSystemAudioCapture({ sessionId, language = 'pt', model = 'base' }) {
  const sid = String(sessionId || `sys-${Date.now().toString(36)}`);
  if (systemSessions.has(sid)) {
    await stopSystemAudioCapture(sid).catch(() => {});
  }
  const status = await getOfflineTranscriberStatus();
  if (!status.wasapiReady) {
    return { ok: false, supported: false, error: 'Captura nativa WASAPI disponível apenas no Windows com motor offline.' };
  }

  const child = spawn(status.pythonBin, [
    status.wasapiScriptPath,
    '--language', String(language || 'pt').split('-')[0].toLowerCase(),
    '--model', model,
    '--chunk-sec', '4.5'
  ], {
    cwd: projectRoot,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }
  });

  const entry = {
    sessionId: sid,
    child,
    active: true,
    ready: false,
    devices: [],
    segments: [],
    error: null,
    stdoutBuf: '',
    stderrTail: '',
    resolveClose: null,
    closePromise: null
  };
  entry.closePromise = new Promise(res => { entry.resolveClose = res; });
  systemSessions.set(sid, entry);

  let resolveReady;
  const readyPromise = new Promise(res => { resolveReady = res; });
  const readyTimeout = setTimeout(() => resolveReady({ ready: false }), 25000);

  child.stdout.on('data', chunk => {
    entry.stdoutBuf += chunk.toString('utf8');
    let nl;
    while ((nl = entry.stdoutBuf.indexOf('\n')) >= 0) {
      const line = entry.stdoutBuf.slice(0, nl).trim();
      entry.stdoutBuf = entry.stdoutBuf.slice(nl + 1);
      if (!line || !line.startsWith('{')) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.type === 'ready' || msg.ready) {
        entry.ready = true;
        entry.devices = Array.isArray(msg.devices) ? msg.devices : [];
        clearTimeout(readyTimeout);
        resolveReady({ ready: true, devices: entry.devices });
      } else if (msg.type === 'segments' && Array.isArray(msg.segments)) {
        entry.segments.push(...msg.segments);
      } else if (msg.type === 'error') {
        entry.error = msg.error || 'Erro no capturador WASAPI.';
        clearTimeout(readyTimeout);
        resolveReady({ ready: false, error: entry.error });
      }
    }
  });

  child.stderr.on('data', chunk => {
    entry.stderrTail = (entry.stderrTail + chunk.toString('utf8')).slice(-600);
  });

  child.on('error', err => {
    entry.error = err.message;
    entry.active = false;
    clearTimeout(readyTimeout);
    resolveReady({ ready: false, error: err.message });
    entry.resolveClose();
  });

  child.on('close', () => {
    entry.active = false;
    clearTimeout(readyTimeout);
    resolveReady({ ready: entry.ready, error: entry.error || entry.stderrTail });
    entry.resolveClose();
  });

  await readyPromise;
  return {
    ok: entry.ready,
    supported: true,
    sessionId: sid,
    devices: entry.devices,
    error: entry.error
  };
}

export function pollSystemAudioCapture(sessionId, cursor = 0) {
  const entry = systemSessions.get(String(sessionId || ''));
  if (!entry) return { ok: false, active: false, segments: [], nextCursor: 0 };
  const idx = Math.max(0, Number(cursor) || 0);
  const slice = entry.segments.slice(idx);
  return {
    ok: true,
    active: entry.active,
    ready: entry.ready,
    devices: entry.devices,
    segments: slice,
    nextCursor: entry.segments.length,
    error: entry.error
  };
}

export async function stopSystemAudioCapture(sessionId, cursor = 0) {
  const sid = String(sessionId || '');
  const entry = systemSessions.get(sid);
  if (!entry) return { ok: true, segments: [] };
  if (entry.active && entry.child) {
    try {
      entry.child.stdin.write(JSON.stringify({ cmd: 'stop' }) + '\n', 'utf8');
      entry.child.stdin.end();
    } catch {}
    await Promise.race([
      entry.closePromise,
      new Promise(res => setTimeout(res, 12000))
    ]);
    if (entry.active) {
      try { entry.child.kill(); } catch {}
    }
  }
  const idx = Math.max(0, Number(cursor) || 0);
  const remaining = entry.segments.slice(idx);
  systemSessions.delete(sid);
  return { ok: true, segments: remaining, devices: entry.devices };
}
