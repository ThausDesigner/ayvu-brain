import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

// Official OpenRouter PKCE. API keys and verifiers never reach browser storage or logs.
export function createRouterOAuth({ connect, fetchImpl = fetch, now = Date.now }) {
  const pending = new Map();
  function begin({ model, origin }) {
    model = String(model || '').trim();
    if (!model || model.length > 160 || /[\x00-\x20]/.test(model)) throw new Error('Informe o modelo OpenRouter antes de conectar.');
    const url = new URL(origin);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Abra o aplicativo no localhost para conectar via OAuth.');
    for (const [key, item] of pending) if (item.expires < now()) pending.delete(key);
    if (pending.size >= 8) throw new Error('Há muitas autorizações pendentes. Aguarde dez minutos.');
    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    pending.set(state, { nonce, verifier, model, expires: now() + 600000 });
    const authorize = new URL('https://openrouter.ai/auth');
    authorize.search = new URLSearchParams({ callback_url: url.origin + '/api/router/oauth/callback', code_challenge: challenge, code_challenge_method: 'S256', state, key_label: 'AYVU Brain local' }).toString();
    return { url: authorize.href, nonce };
  }
  async function finish({ state, code, nonce }) {
    const item = pending.get(state);
    if (!item || item.expires < now()) { pending.delete(state); throw new Error('Autorização expirada. Inicie novamente.'); }
    const a = Buffer.from(String(nonce || '')), b = Buffer.from(item.nonce);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Esta autorização pertence a outro navegador.');
    pending.delete(state); // A code/state pair is single-use, including failed exchanges.
    if (typeof code !== 'string' || !code || code.length > 4096) throw new Error('Autorização recusada ou código inválido.');
    const response = await fetchImpl('https://openrouter.ai/api/v1/auth/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, code_verifier: item.verifier, code_challenge_method: 'S256' }), signal: AbortSignal.timeout(30000) });
    if (!response.ok) { await response.body?.cancel(); throw new Error('O OpenRouter não concluiu a autorização. Tente novamente.'); }
    const data = await response.json();
    if (typeof data.key !== 'string' || !data.key) throw new Error('O OpenRouter não retornou uma credencial válida.');
    connect({ provider: 'openrouter', model: item.model, apiKey: data.key, label: `OpenRouter OAuth · ${item.model}`, free: false });
    return { ok: true };
  }
  return { begin, finish };
}
