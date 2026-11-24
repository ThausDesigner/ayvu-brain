import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export const MCP_MARKET_CATALOG = [
  {
    id: 'github',
    name: 'GitHub',
    category: 'Dev & Git',
    description: 'Repositórios, pull requests, issues, commits e busca de código.',
    transport: 'http',
    url: 'https://api.githubcopilot.com/mcp/',
    aliases: ['github', 'github_mcp']
  },
  {
    id: 'figma',
    name: 'Figma',
    category: 'Design',
    description: 'Design context, tokens, screenshots, Code Connect e geração no canvas.',
    transport: 'http',
    url: 'https://mcp.figma.com/mcp',
    aliases: ['figma', 'figma_figma']
  },
  {
    id: 'vercel',
    name: 'Vercel',
    category: 'Deploy & Cloud',
    description: 'Deploys, logs, variáveis de ambiente, domínios e preview URLs.',
    transport: 'http',
    url: 'https://mcp.vercel.com',
    aliases: ['vercel', 'vercel-plugin', 'vercel-plugin_vercel']
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    category: 'Deploy & Cloud',
    description: 'Workers, KV, D1, R2, DNS, Zero Trust e documentação oficial.',
    transport: 'http',
    url: 'https://docs.mcp.cloudflare.com/mcp',
    aliases: ['cloudflare', 'cloudflare_cloudflare']
  },
  {
    id: 'supabase',
    name: 'Supabase',
    category: 'Dados & DB',
    description: 'Postgres gerenciado, migrações, SQL, Auth e Edge Functions.',
    transport: 'http',
    url: 'https://mcp.supabase.com/mcp',
    aliases: ['supabase', 'supabase_mcp']
  },
  {
    id: 'firebase',
    name: 'Firebase',
    category: 'Deploy & Cloud',
    description: 'Firestore, Auth, Hosting, App Hosting e Security Rules.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'firebase-tools@latest', 'experimental:mcp'],
    aliases: ['firebase']
  },
  {
    id: 'neon',
    name: 'Neon Postgres',
    category: 'Dados & DB',
    description: 'Postgres serverless com branching, SQL tuning e snapshots.',
    transport: 'http',
    url: 'https://mcp.neon.tech/mcp',
    aliases: ['neon', 'neon_mcp']
  },
  {
    id: 'railway',
    name: 'Railway',
    category: 'Deploy & Cloud',
    description: 'Serviços backend, variáveis, logs, métricas e deploys rápidos.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@railway/mcp-server'],
    aliases: ['railway', 'railway_mcp']
  },
  {
    id: 'framer',
    name: 'Framer',
    category: 'Design',
    description: 'Edição de sites, CMS, componentes e tokens direto no Framer.',
    transport: 'http',
    url: 'https://mcp.framer.com/mcp',
    aliases: ['framer', 'framer_mcp']
  },
  {
    id: 'webflow',
    name: 'Webflow',
    category: 'Design',
    description: 'Sites, coleções CMS, Designer, assets e scripts Webflow.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'webflow-mcp-server'],
    aliases: ['webflow', 'webflow_mcp']
  },
  {
    id: 'make',
    name: 'Make',
    category: 'Automação',
    description: 'Cenários, webhooks, data stores e execuções de automação.',
    transport: 'http',
    url: 'https://mcp.make.com',
    aliases: ['make', 'make_mcp']
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'Produtividade',
    description: 'Leitura de canais, threads, envio de mensagens e reações.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    aliases: ['slack', 'slack_mcp']
  },
  {
    id: 'magnific',
    name: 'Magnific',
    category: 'Design',
    description: 'Geração de imagem, upscale, vídeo, áudio e cenas 3D.',
    transport: 'http',
    url: 'https://mcp.magnific.ai/mcp',
    aliases: ['magnific', 'magnific_mcp']
  },
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'Google Workspace',
    description: 'Leitura, busca, rascunhos, envio e organização de emails.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@gongrzhe/server-gmail-autoauth-mcp'],
    aliases: ['gmail']
  },
  {
    id: 'gcalendar',
    name: 'Google Calendar',
    category: 'Google Workspace',
    description: 'Agenda, criação de eventos, disponibilidade e convites.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@cocal/google-calendar-mcp'],
    aliases: ['gcalendar', 'google-calendar']
  },
  {
    id: 'gdrive',
    name: 'Google Drive',
    category: 'Google Workspace',
    description: 'Busca, leitura, exportação e permissões de arquivos no Drive.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-gdrive'],
    aliases: ['gdrive', 'google-drive']
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'Produtividade',
    description: 'Páginas, databases, wikis e busca estruturada no workspace.',
    transport: 'http',
    url: 'https://mcp.notion.com/mcp',
    aliases: ['notion', 'notion_mcp']
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'Produtividade',
    description: 'Issues, ciclos, roadmaps e acompanhamento de sprints.',
    transport: 'http',
    url: 'https://mcp.linear.app/mcp',
    aliases: ['linear', 'linear_mcp']
  },
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'Negócios & Pagamentos',
    description: 'Cobranças, assinaturas, clientes, produtos e faturas.',
    transport: 'http',
    url: 'https://mcp.stripe.com',
    aliases: ['stripe', 'stripe_mcp']
  },
  {
    id: 'playwright',
    name: 'Playwright',
    category: 'Web & Browser',
    description: 'Automação real de navegador, inspeção de DOM e QA visual.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest'],
    aliases: ['playwright', 'playwright_mcp']
  },
  {
    id: 'context7',
    name: 'Context7',
    category: 'Dev & Git',
    description: 'Documentação atualizada e exemplos de código direto das libs.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp'],
    aliases: ['context7']
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    category: 'Dados & DB',
    description: 'Consultas SQL e inspeção de schemas em qualquer Postgres.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'],
    aliases: ['postgres', 'postgresql']
  },
  {
    id: 'filesystem',
    name: 'Filesystem',
    category: 'Dev & Git',
    description: 'Leitura e escrita controlada em diretórios locais autorizados.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    aliases: ['filesystem']
  },
  {
    id: 'memory',
    name: 'Memory Graph',
    category: 'Produtividade',
    description: 'Memória persistente em grafo de entidades e relações.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    aliases: ['memory']
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    category: 'Dev & Git',
    description: 'Raciocínio estruturado passo a passo para problemas complexos.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    aliases: ['sequential-thinking', 'sequential_thinking']
  },
  {
    id: 'sentry',
    name: 'Sentry',
    category: 'Dev & Git',
    description: 'Monitoramento de erros, stack traces e triagem de issues.',
    transport: 'http',
    url: 'https://mcp.sentry.dev/mcp',
    aliases: ['sentry', 'sentry_mcp']
  },
  {
    id: 'atlassian',
    name: 'Jira & Confluence',
    category: 'Produtividade',
    description: 'Issues Jira, documentação Confluence e contexto de equipe.',
    transport: 'http',
    url: 'https://mcp.atlassian.com/v1/sse',
    aliases: ['atlassian', 'jira', 'confluence']
  },
  {
    id: 'hubspot',
    name: 'HubSpot CRM',
    category: 'Negócios & Pagamentos',
    description: 'Contatos, empresas, deals e pipelines de vendas.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@hubspot/mcp-server'],
    aliases: ['hubspot']
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    category: 'Web & Browser',
    description: 'Pesquisa web rápida para agentes com foco em privacidade.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    aliases: ['brave-search', 'brave']
  },
  {
    id: 'n8n',
    name: 'n8n',
    category: 'Automação',
    description: 'Criação, teste e gestão de workflows n8n via MCP.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'n8n-mcp'],
    aliases: ['n8n', 'n8n-skills']
  }
];

export function defaultMcpPaths(home = homedir()) {
  return {
    claudeJson: join(home, '.claude.json'),
    claudeSettings: join(home, '.claude', 'settings.json'),
    codexToml: join(home, '.codex', 'config.toml'),
    agyMcpConfig: join(home, '.gemini', 'antigravity', 'mcp_config.json'),
    agyMcpDir: join(home, '.gemini', 'antigravity', 'mcp'),
    agyPluginsDir: join(home, '.gemini', 'config', 'plugins')
  };
}

async function readJsonSafe(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function sanitizeUrl(raw) {
  if (!raw) return '';
  return String(raw).split('?')[0];
}

function normalizeServerId(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function parseCodexTomlServers(tomlText) {
  const servers = new Map();
  let current = null;
  for (const raw of String(tomlText || '').split(/\r?\n/)) {
    const line = raw.trim();
    const header = line.match(/^\[mcp_servers\.([A-Za-z0-9_-]+)(?:\.([^\]]+))?\]$/);
    if (header) {
      const id = header[1];
      if (!servers.has(id)) servers.set(id, { name: id, source: '~/.codex/config.toml', transport: 'stdio', command: '', url: '' });
      current = header[2] ? null : servers.get(id);
      continue;
    }
    if (line.startsWith('[')) { current = null; continue; }
    if (!current || !line || line.startsWith('#')) continue;
    const urlMatch = line.match(/^url\s*=\s*"([^"]+)"/);
    if (urlMatch) { current.url = sanitizeUrl(urlMatch[1]); current.transport = 'http'; }
    const cmdMatch = line.match(/^command\s*=\s*"([^"]+)"/);
    if (cmdMatch) { current.command = cmdMatch[1]; current.transport = 'stdio'; }
  }
  return [...servers.values()];
}

export async function scanInstalledMcps(paths = defaultMcpPaths()) {
  const detected = { claude: [], codex: [], antigravity: [] };

  const claudeJson = await readJsonSafe(paths.claudeJson);
  if (claudeJson?.mcpServers && typeof claudeJson.mcpServers === 'object') {
    for (const [name, cfg] of Object.entries(claudeJson.mcpServers)) {
      if (!cfg || typeof cfg !== 'object') continue;
      detected.claude.push({
        name,
        source: '~/.claude.json',
        transport: cfg.type || (cfg.url ? 'http' : 'stdio'),
        command: cfg.command || '',
        url: sanitizeUrl(cfg.url || cfg.serverUrl)
      });
    }
  }
  const claudeSettings = await readJsonSafe(paths.claudeSettings);
  if (claudeSettings?.enabledPlugins && typeof claudeSettings.enabledPlugins === 'object') {
    for (const [name, enabled] of Object.entries(claudeSettings.enabledPlugins)) {
      if (!enabled) continue;
      detected.claude.push({ name, source: '~/.claude/settings.json', transport: 'plugin', command: '', url: '' });
    }
  }

  try {
    const toml = await fs.readFile(paths.codexToml, 'utf8');
    detected.codex.push(...parseCodexTomlServers(toml));
  } catch {}

  const agySeen = new Set();
  const agyJson = await readJsonSafe(paths.agyMcpConfig);
  if (agyJson?.mcpServers && typeof agyJson.mcpServers === 'object') {
    for (const [name, cfg] of Object.entries(agyJson.mcpServers)) {
      if (!cfg || typeof cfg !== 'object') continue;
      agySeen.add(name.toLowerCase());
      detected.antigravity.push({
        name,
        source: 'mcp_config.json',
        transport: cfg.serverUrl || cfg.url ? 'http' : 'stdio',
        command: cfg.command || '',
        url: sanitizeUrl(cfg.serverUrl || cfg.url)
      });
    }
  }
  try {
    for (const dir of await fs.readdir(paths.agyMcpDir)) {
      if (agySeen.has(dir.toLowerCase())) continue;
      agySeen.add(dir.toLowerCase());
      detected.antigravity.push({ name: dir, source: 'antigravity/mcp/', transport: 'managed', command: '', url: '' });
    }
  } catch {}
  try {
    for (const plug of await fs.readdir(paths.agyPluginsDir)) {
      if (agySeen.has(plug.toLowerCase())) continue;
      agySeen.add(plug.toLowerCase());
      detected.antigravity.push({ name: plug, source: 'config/plugins/', transport: 'plugin', command: '', url: '' });
    }
  } catch {}

  const matchesClient = (list, aliases) => {
    const normAliases = new Set(aliases.map(a => a.toLowerCase()));
    return list.some(item => {
      const n = item.name.toLowerCase();
      if (normAliases.has(n)) return true;
      for (const a of normAliases) {
        if (n === `${a}_mcp` || n === `${a}_${a}` || n.startsWith(`${a}-plugin`)) return true;
      }
      return false;
    });
  };

  const catalog = MCP_MARKET_CATALOG.map(entry => {
    const aliases = entry.aliases || [entry.id];
    const connected = {
      claude: matchesClient(detected.claude, aliases),
      codex: matchesClient(detected.codex, aliases),
      antigravity: matchesClient(detected.antigravity, aliases)
    };
    return {
      ...entry,
      connected,
      connectedCount: Number(connected.claude) + Number(connected.codex) + Number(connected.antigravity)
    };
  });

  const knownAliases = new Set(MCP_MARKET_CATALOG.flatMap(e => (e.aliases || [e.id]).map(a => a.toLowerCase())));
  const customMap = new Map();
  for (const [client, list] of Object.entries(detected)) {
    for (const item of list) {
      const lower = item.name.toLowerCase();
      if (knownAliases.has(lower)) continue;
      let isKnown = false;
      for (const a of knownAliases) {
        if (lower === `${a}_mcp` || lower === `${a}_${a}` || lower.startsWith(`${a}-plugin`)) { isKnown = true; break; }
      }
      if (isKnown) continue;
      if (!customMap.has(lower)) {
        customMap.set(lower, {
          id: normalizeServerId(item.name) || lower,
          name: item.name,
          category: 'Personalizado / Local',
          description: `Detectado localmente (${item.source}).`,
          transport: item.transport || 'stdio',
          command: item.command || '',
          url: item.url || '',
          custom: true,
          connected: { claude: false, codex: false, antigravity: false },
          connectedCount: 0
        });
      }
      const entry = customMap.get(lower);
      if (!entry.connected[client]) {
        entry.connected[client] = true;
        entry.connectedCount += 1;
      }
    }
  }

  return {
    catalog: [...catalog, ...customMap.values()],
    detected,
    summary: {
      claude: detected.claude.length,
      codex: detected.codex.length,
      antigravity: detected.antigravity.length,
      totalCatalog: catalog.length + customMap.size
    }
  };
}

function tomlEscape(str) {
  return String(str || '').replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function removeTomlServerSection(tomlText, id) {
  const lines = String(tomlText || '').split(/\r?\n/);
  const out = [];
  let skipping = false;
  const prefix = `[mcp_servers.${id}`;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) {
      skipping = trimmed === `[mcp_servers.${id}]` || trimmed.startsWith(`${prefix}.`);
    }
    if (!skipping) out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function buildCodexTomlBlock(id, cfg) {
  const lines = [`[mcp_servers.${id}]`];
  if (cfg.transport === 'http' || cfg.transport === 'sse') {
    lines.push(`url = "${tomlEscape(cfg.url)}"`);
  } else {
    lines.push(`command = "${tomlEscape(cfg.command)}"`);
    if (cfg.args?.length) {
      lines.push(`args = [${cfg.args.map(a => `"${tomlEscape(a)}"`).join(', ')}]`);
    }
  }
  if (cfg.env && Object.keys(cfg.env).length) {
    lines.push(`[mcp_servers.${id}.env]`);
    for (const [k, v] of Object.entries(cfg.env)) {
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) {
        lines.push(`${k} = "${tomlEscape(v)}"`);
      }
    }
  }
  return lines.join('\n');
}

export async function connectMcpServer(input, paths = defaultMcpPaths()) {
  const id = normalizeServerId(input.name || input.id);
  if (!id) throw new Error('Nome do servidor MCP inválido.');
  const transport = ['http', 'sse', 'stdio'].includes(input.transport) ? input.transport : (input.url ? 'http' : 'stdio');
  const url = String(input.url || '').trim();
  const command = String(input.command || '').trim();
  const args = Array.isArray(input.args)
    ? input.args.map(a => String(a).trim()).filter(Boolean)
    : String(input.args || '').split(/\s+/).map(s => s.trim()).filter(Boolean);
  const env = (input.env && typeof input.env === 'object') ? input.env : {};
  const headers = (input.headers && typeof input.headers === 'object') ? input.headers : {};

  if ((transport === 'http' || transport === 'sse') && !/^https?:\/\//i.test(url)) {
    throw new Error('Informe uma URL http:// ou https:// válida para MCP remoto.');
  }
  if (transport === 'stdio' && !command) {
    throw new Error('Informe o comando (ex: npx, node, python) para MCP stdio.');
  }

  const targets = Array.isArray(input.targets) && input.targets.length
    ? input.targets.filter(t => ['claude', 'codex', 'antigravity'].includes(t))
    : ['claude', 'codex', 'antigravity'];
  if (!targets.length) throw new Error('Selecione ao menos uma CLI de destino.');

  const updated = [];

  if (targets.includes('claude')) {
    const existing = (await readJsonSafe(paths.claudeJson)) || {};
    existing.mcpServers = existing.mcpServers || {};
    existing.mcpServers[id] = transport === 'stdio'
      ? { type: 'stdio', command, args, ...(Object.keys(env).length ? { env } : {}) }
      : { type: transport, url, ...(Object.keys(headers).length ? { headers } : {}) };
    await fs.mkdir(dirname(paths.claudeJson), { recursive: true });
    await fs.writeFile(paths.claudeJson, JSON.stringify(existing, null, 2) + '\n', 'utf8');
    updated.push('claude');
  }

  if (targets.includes('codex')) {
    let toml = '';
    try { toml = await fs.readFile(paths.codexToml, 'utf8'); } catch {}
    const cleaned = toml ? removeTomlServerSection(toml, id) : '';
    const block = buildCodexTomlBlock(id, { transport, url, command, args, env });
    await fs.mkdir(dirname(paths.codexToml), { recursive: true });
    await fs.writeFile(paths.codexToml, `${cleaned.trimEnd()}\n\n${block}\n`.replace(/^\n+/, ''), 'utf8');
    updated.push('codex');
  }

  if (targets.includes('antigravity')) {
    const existing = (await readJsonSafe(paths.agyMcpConfig)) || {};
    existing.mcpServers = existing.mcpServers || {};
    existing.mcpServers[id] = transport === 'stdio'
      ? { command, args, ...(Object.keys(env).length ? { env } : {}) }
      : { serverUrl: url, ...(Object.keys(headers).length ? { headers } : {}) };
    await fs.mkdir(dirname(paths.agyMcpConfig), { recursive: true });
    await fs.writeFile(paths.agyMcpConfig, JSON.stringify(existing, null, 2) + '\n', 'utf8');
    updated.push('antigravity');
  }

  return { ok: true, id, transport, targets: updated };
}

export async function disconnectMcpServer({ id, name, target }, paths = defaultMcpPaths()) {
  const serverId = normalizeServerId(id || name);
  if (!serverId) throw new Error('Nome do servidor MCP inválido.');
  if (!['claude', 'codex', 'antigravity'].includes(target)) throw new Error('Alvo inválido.');

  if (target === 'claude') {
    const existing = await readJsonSafe(paths.claudeJson);
    if (existing?.mcpServers && Object.hasOwn(existing.mcpServers, serverId)) {
      delete existing.mcpServers[serverId];
      await fs.writeFile(paths.claudeJson, JSON.stringify(existing, null, 2) + '\n', 'utf8');
    }
  } else if (target === 'codex') {
    try {
      const toml = await fs.readFile(paths.codexToml, 'utf8');
      await fs.writeFile(paths.codexToml, removeTomlServerSection(toml, serverId), 'utf8');
    } catch {}
  } else if (target === 'antigravity') {
    const existing = await readJsonSafe(paths.agyMcpConfig);
    if (existing?.mcpServers && Object.hasOwn(existing.mcpServers, serverId)) {
      delete existing.mcpServers[serverId];
      await fs.writeFile(paths.agyMcpConfig, JSON.stringify(existing, null, 2) + '\n', 'utf8');
    }
  }
  return { ok: true, id: serverId, target };
}
