import { promises as fs } from 'node:fs';
import { join, resolve, relative, isAbsolute, basename, extname } from 'node:path';

const SESSION_META_RE = /<!--\s*ayvu-session-data:\s*([\s\S]*?)\s*-->\s*$/;

export function sanitizeSessionId(raw) {
  const clean = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  if (!clean) throw new Error('Invalid session ID.');
  return clean;
}

export function sanitizeFilename(raw) {
  const base = basename(String(raw || '').trim()).replace(/[\x00-\x1f<>:"/\\|?*]+/g, '-');
  const ext = extname(base).slice(0, 16);
  const stem = base.slice(0, base.length - ext.length)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'arquivo';
  return `${stem}${ext}`;
}

function chatsDir(vaultRoot) {
  return resolve(vaultRoot, '_sessions', 'chats');
}

function attachmentsDir(vaultRoot, sessionId) {
  const id = sanitizeSessionId(sessionId);
  const base = resolve(vaultRoot, '_sessions', 'attachments');
  const full = resolve(base, id);
  const rel = relative(base, full);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Invalid attachment directory.');
  return full;
}

function sessionFilePath(vaultRoot, sessionId) {
  const id = sanitizeSessionId(sessionId);
  const base = chatsDir(vaultRoot);
  const full = resolve(base, `${id}.md`);
  const rel = relative(base, full);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Invalid session path.');
  return { id, full, relPath: `_sessions/chats/${id}.md` };
}

function renderSessionMarkdown(session) {
  const created = (session.createdAt || new Date().toISOString()).slice(0, 10);
  const updated = (session.updatedAt || new Date().toISOString()).slice(0, 10);
  const lines = [
    '---',
    'tags: [session, chat, cli]',
    'status: active',
    `session_id: ${session.id}`,
    `engine: ${session.engine || 'claude'}`,
    `created: ${created}`,
    `updated: ${updated}`,
    '---',
    '',
    `# ${session.title || 'Nova sessão'}`,
    ''
  ];

  if (session.cwd) lines.push(`- **Diretório:** \`${session.cwd}\``);
  if (session.contextPath) lines.push(`- **Contexto:** [[${session.contextPath}]]`);
  if (session.attachments?.length) {
    lines.push('- **Arquivos da sessão:**');
    for (const att of session.attachments) {
      lines.push(`  - \`${att.name}\` (\`${att.relPath}\`)`);
    }
  }
  lines.push('', '## Conversa', '');

  for (const msg of session.messages || []) {
    const roleLabel = msg.role === 'assistant' ? `Assistente (${msg.engine || session.engine || 'cli'})` : 'Você';
    const stamp = msg.createdAt ? ` · ${msg.createdAt.slice(11, 16)}` : '';
    lines.push(`### ${roleLabel}${stamp}`, '', String(msg.content || '').trim(), '');
  }

  const payload = JSON.stringify({
    id: session.id,
    title: session.title,
    engine: session.engine,
    mode: session.mode,
    cwd: session.cwd,
    contextPath: session.contextPath,
    continueSession: Boolean(session.continueSession),
    structuredQuestions: Boolean(session.structuredQuestions),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    attachments: session.attachments || [],
    messages: session.messages || []
  }).replaceAll('-->', '--\\u003e');

  lines.push(`<!-- ayvu-session-data: ${payload} -->`, '');
  return lines.join('\n');
}

function parseSessionMarkdown(raw, fallbackId) {
  const match = String(raw || '').match(SESSION_META_RE);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      return {
        id: parsed.id || fallbackId,
        title: parsed.title || fallbackId,
        engine: parsed.engine || 'claude',
        mode: parsed.mode || 'conversation',
        cwd: parsed.cwd || '',
        contextPath: parsed.contextPath || '',
        continueSession: Boolean(parsed.continueSession),
        structuredQuestions: Boolean(parsed.structuredQuestions),
        createdAt: parsed.createdAt || new Date().toISOString(),
        updatedAt: parsed.updatedAt || parsed.createdAt || new Date().toISOString(),
        attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        relPath: `_sessions/chats/${parsed.id || fallbackId}.md`
      };
    } catch {}
  }
  const title = (String(raw || '').match(/^#\s+(.+)$/m)?.[1] || fallbackId).trim();
  return {
    id: fallbackId,
    title,
    engine: 'claude',
    mode: 'conversation',
    cwd: '',
    contextPath: '',
    continueSession: false,
    structuredQuestions: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attachments: [],
    messages: [],
    relPath: `_sessions/chats/${fallbackId}.md`
  };
}

export async function listSessions(vaultRoot) {
  const dir = chatsDir(vaultRoot);
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return []; }
  const items = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const id = entry.name.replace(/\.md$/, '');
    try {
      const raw = await fs.readFile(join(dir, entry.name), 'utf8');
      const data = parseSessionMarkdown(raw, id);
      items.push({
        id: data.id,
        title: data.title,
        engine: data.engine,
        cwd: data.cwd,
        messageCount: data.messages.length,
        attachmentCount: data.attachments.length,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        relPath: data.relPath
      });
    } catch {}
  }
  return items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function getSession(vaultRoot, sessionId) {
  const { id, full } = sessionFilePath(vaultRoot, sessionId);
  const raw = await fs.readFile(full, 'utf8');
  return parseSessionMarkdown(raw, id);
}

export async function saveSession(vaultRoot, input) {
  const now = new Date().toISOString();
  const id = sanitizeSessionId(input.id || `sessao-${Date.now().toString(36)}`);
  const { full, relPath } = sessionFilePath(vaultRoot, id);
  await fs.mkdir(chatsDir(vaultRoot), { recursive: true });

  const messages = Array.isArray(input.messages)
    ? input.messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || ''),
        engine: m.engine ? String(m.engine) : undefined,
        createdAt: m.createdAt || now
      }))
    : [];

  const firstUser = messages.find(m => m.role === 'user')?.content || '';
  const autoTitle = firstUser.replace(/\s+/g, ' ').trim().slice(0, 64) || 'Nova sessão';
  const title = String(input.title || '').trim() || autoTitle;

  const session = {
    id,
    title,
    engine: String(input.engine || 'claude'),
    mode: String(input.mode || 'conversation'),
    cwd: String(input.cwd || ''),
    contextPath: String(input.contextPath || ''),
    continueSession: Boolean(input.continueSession),
    structuredQuestions: input.structuredQuestions !== false,
    createdAt: input.createdAt || now,
    updatedAt: now,
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    messages,
    relPath
  };

  await fs.writeFile(full, renderSessionMarkdown(session), 'utf8');
  return session;
}

export async function deleteSession(vaultRoot, sessionId) {
  const { id, full } = sessionFilePath(vaultRoot, sessionId);
  await fs.rm(full, { force: true });
  await fs.rm(attachmentsDir(vaultRoot, id), { recursive: true, force: true });
  return { ok: true, id };
}

export async function saveSessionAttachment(vaultRoot, sessionId, { name, mimeType, dataBase64 }) {
  if (!dataBase64 || typeof dataBase64 !== 'string') throw new Error('File data is required.');
  const id = sanitizeSessionId(sessionId);
  const dir = attachmentsDir(vaultRoot, id);
  await fs.mkdir(dir, { recursive: true });

  const safeName = sanitizeFilename(name || 'arquivo');
  const ext = extname(safeName);
  const stem = safeName.slice(0, safeName.length - ext.length);
  let finalName = safeName;
  let full = join(dir, finalName);
  for (let i = 1; i <= 99; i += 1) {
    try {
      await fs.access(full);
      finalName = `${stem}-${i}${ext}`;
      full = join(dir, finalName);
    } catch {
      break;
    }
  }

  const buffer = Buffer.from(dataBase64, 'base64');
  await fs.writeFile(full, buffer);

  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: finalName,
    originalName: String(name || finalName),
    mimeType: String(mimeType || 'application/octet-stream'),
    size: buffer.length,
    relPath: `_sessions/attachments/${id}/${finalName}`,
    fullPath: full,
    url: `/api/sessions/${encodeURIComponent(id)}/attachments/${encodeURIComponent(finalName)}`,
    uploadedAt: new Date().toISOString()
  };
}

export async function readSessionAttachment(vaultRoot, sessionId, filename) {
  const id = sanitizeSessionId(sessionId);
  const safeName = basename(String(filename || ''));
  if (!safeName || safeName.includes('..')) throw new Error('Invalid attachment filename.');
  const dir = attachmentsDir(vaultRoot, id);
  const full = resolve(dir, safeName);
  const rel = relative(dir, full);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Attachment path escapes session.');
  const buffer = await fs.readFile(full);
  return { buffer, filename: safeName, fullPath: full };
}

export async function removeSessionAttachment(vaultRoot, sessionId, filename) {
  const id = sanitizeSessionId(sessionId);
  const safeName = basename(String(filename || ''));
  if (!safeName || safeName.includes('..')) throw new Error('Invalid attachment filename.');
  const dir = attachmentsDir(vaultRoot, id);
  const full = resolve(dir, safeName);
  const rel = relative(dir, full);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Attachment path escapes session.');
  await fs.rm(full, { force: true });
  return { ok: true, filename: safeName };
}
