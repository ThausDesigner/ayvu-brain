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
  return { baseDir, pythonBin, scriptPath };
}

export async function getOfflineTranscriberStatus() {
  const { pythonBin, scriptPath } = getOfflineTranscriberPaths();
  let pythonReady = false;
  let scriptReady = false;
  try { await fs.access(pythonBin); pythonReady = true; } catch {}
  try { await fs.access(scriptPath); scriptReady = true; } catch {}
  return {
    ready: pythonReady && scriptReady,
    pythonReady,
    scriptReady,
    engine: 'faster-whisper-small-offline',
    pythonBin,
    scriptPath
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
      windowsHide: true
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
