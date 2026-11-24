export const API_PROVIDERS = {
  openai: { label: 'OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', format: 'openai' },
  claude: { label: 'Anthropic', endpoint: 'https://api.anthropic.com/v1/messages', format: 'anthropic' },
  gemini: { label: 'Google Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/', format: 'gemini' },
  grok: { label: 'xAI / Grok', endpoint: 'https://api.x.ai/v1/chat/completions', format: 'openai' },
  groq: { label: 'Groq', endpoint: 'https://api.groq.com/openai/v1/chat/completions', format: 'openai' },
  openrouter: { label: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions', format: 'openai' },
  ollama: { label: 'Ollama local', endpoint: 'http://127.0.0.1:11434/v1/chat/completions', format: 'openai', local: true }
};

export async function callRouterProvider(connection, prepared, { maxOutputTokens, signal, fetchImpl = fetch }) {
  const config = API_PROVIDERS[connection.provider];
  if (!config) throw new Error('Provedor não suportado.');
  const { model, apiKey } = connection;
  const headers = { 'Content-Type': 'application/json' };
  let url = config.endpoint;
  let body;
  if (config.format === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    body = { model, system: prepared.system, messages: prepared.messages, max_tokens: maxOutputTokens };
  } else if (config.format === 'gemini') {
    headers['x-goog-api-key'] = apiKey;
    url += `${encodeURIComponent(model)}:generateContent`;
    body = { systemInstruction: { parts: [{ text: prepared.system }] }, contents: prepared.messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), generationConfig: { maxOutputTokens } };
  } else {
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    body = { model, messages: [{ role: 'system', content: prepared.system }, ...prepared.messages],
      [connection.provider === 'openai' ? 'max_completion_tokens' : 'max_tokens']: maxOutputTokens };
  }
  let res;
  try { res = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal }); }
  catch (cause) { throw Object.assign(new Error('Conexão interrompida; a cobrança da tentativa é desconhecida.'), { code: 'transport', cause }); }
  if (!res.ok) {
    // Do not propagate provider bodies: some echo credentials or submitted text.
    await res.body?.cancel();
    const raw = res.headers.get('retry-after');
    const retryAfterMs = /^\d+$/.test(raw || '') ? Number(raw) * 1000 : Math.max(0, Date.parse(raw || '') - Date.now());
    throw Object.assign(new Error(`Provedor respondeu HTTP ${res.status}.`), { status: res.status, retryAfterMs });
  }
  const data = await res.json();
  let reply, input, output;
  if (config.format === 'anthropic') {
    reply = data.content?.filter(c => c.type === 'text').map(c => c.text).join('\n');
    input = data.usage?.input_tokens;
    if (Number.isFinite(input)) input += (data.usage.cache_creation_input_tokens || 0) + (data.usage.cache_read_input_tokens || 0);
    output = data.usage?.output_tokens;
  } else if (config.format === 'gemini') {
    reply = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n');
    input = data.usageMetadata?.promptTokenCount;
    output = data.usageMetadata?.candidatesTokenCount;
    if (Number.isFinite(output)) output += data.usageMetadata?.thoughtsTokenCount || 0;
  } else {
    reply = data.choices?.[0]?.message?.content;
    input = data.usage?.prompt_tokens; output = data.usage?.completion_tokens;
  }
  if (typeof reply !== 'string' || !reply.trim()) throw new Error('O provedor retornou uma resposta vazia ou um formato não suportado.');
  const usage = Number.isFinite(input) && input >= 0 && Number.isFinite(output) && output >= 0 ? { input, output, estimated: false } : null;
  return { reply, provider: connection.provider, model: data.model || model, usage };
}
