import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startAyvuBrainServer, validateSafeRelPath, saveUniqueNote } from '../src/server.mjs';

const temp = await fs.mkdtemp(join(tmpdir(), 'ayvu-brain-test-'));
test.after(async () => { await fs.rm(temp, { recursive: true, force: true }); });

test('AYVU Brain serves site, app, vault tree, note save and rejects secrets or traversal', async () => {
  await fs.mkdir(join(temp, '_memory'), { recursive: true });
  await fs.mkdir(join(temp, '_sync/fios'), { recursive: true });
  await fs.mkdir(join(temp, '_sessions'), { recursive: true });
  await fs.writeFile(join(temp, '_memory/current-state.md'), '# Current State\nTest OK\n');
  await fs.writeFile(join(temp, '_sync/fios/fio-demo.md'), '---\nstatus: active\nem_uso_por: gemini\n---\n\n# Fio Demo\n');

  assert.throws(() => validateSafeRelPath(temp, '../escape.md'), /Invalid|escapes/);
  assert.throws(() => validateSafeRelPath(temp, 'Drive/huge.md'), /outside allowed/);
  assert.doesNotThrow(() => validateSafeRelPath(temp, '_memory/current-state.md'));

  const leaked = ['xai-', 'A'.repeat(30)].join('');
  await assert.rejects(saveUniqueNote({ vaultRoot: temp, targetDir: '_sessions', title: 'Bad', content: leaked }), /secret/i);

  const mcpDir = join(temp, 'mcp-home');
  const mcpPaths = {
    claudeJson: join(mcpDir, '.claude.json'),
    claudeSettings: join(mcpDir, '.claude', 'settings.json'),
    codexToml: join(mcpDir, '.codex', 'config.toml'),
    agyMcpConfig: join(mcpDir, '.gemini', 'antigravity', 'mcp_config.json'),
    agyMcpDir: join(mcpDir, '.gemini', 'antigravity', 'mcp'),
    agyPluginsDir: join(mcpDir, '.gemini', 'config', 'plugins')
  };
  await fs.mkdir(join(mcpDir, '.codex'), { recursive: true });
  await fs.writeFile(mcpPaths.codexToml, '[mcp_servers.figma]\nurl = "https://mcp.figma.com/mcp"\n');

  const running = await startAyvuBrainServer({ vaultRoot: temp, mcpPaths, port: 0 });
  try {
    const siteRes = await fetch(`${running.url}/`);
    assert.equal(siteRes.status, 200);
    assert.match(await siteRes.text(), /AYVU Brain/);

    const appRes = await fetch(`${running.url}/app`);
    assert.equal(appRes.status, 200);
    assert.match(await appRes.text(), /Multi-IA Chat/);

    const info = await (await fetch(`${running.url}/api/info`)).json();
    assert.equal(info.domain, 'brain.ayvu.org');
    assert.equal(info.threadsDir, '_sync/fios');
    assert.equal(info.voiceShortcut, 'Ctrl+Space');
    assert.ok(info.appRoot);

    const cliStatus = await (await fetch(`${running.url}/api/cli/status`)).json();
    assert.equal(cliStatus.engines.length, 3);
    assert.deepEqual(cliStatus.engines.map(e => e.id), ['claude', 'codex', 'agy']);

    // Sessions auto-save & attachments
    const savedSess = await (await fetch(`${running.url}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'sessao-teste',
        engine: 'claude',
        messages: [
          { role: 'user', content: 'Organizar prioridades da semana' },
          { role: 'assistant', content: '- [ ] Prioridade 1\n- [ ] Prioridade 2' }
        ]
      })
    })).json();
    assert.equal(savedSess.ok, true);
    assert.equal(savedSess.session.id, 'sessao-teste');

    const attRes = await fetch(`${running.url}/api/sessions/sessao-teste/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'briefing.txt',
        mimeType: 'text/plain',
        dataBase64: Buffer.from('Conteudo anexo da sessao').toString('base64')
      })
    });
    assert.equal(attRes.status, 201);
    const attJson = await attRes.json();
    assert.equal(attJson.attachment.name, 'briefing.txt');
    const dl = await fetch(`${running.url}${attJson.attachment.url}`);
    assert.equal(dl.status, 200);
    assert.equal(await dl.text(), 'Conteudo anexo da sessao');

    const sessList = await (await fetch(`${running.url}/api/sessions`)).json();
    assert.equal(sessList.items.length, 1);
    const sessDetail = await (await fetch(`${running.url}/api/sessions/sessao-teste`)).json();
    assert.equal(sessDetail.session.messages.length, 2);

    // MCP catalog scan + manual connect/disconnect
    const mcpBefore = await (await fetch(`${running.url}/api/mcp/catalog`)).json();
    assert.ok(mcpBefore.catalog.length >= 25);
    assert.equal(mcpBefore.catalog.find(c => c.id === 'figma').connected.codex, true);

    const mcpConn = await (await fetch(`${running.url}/api/mcp/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'custom-crm',
        transport: 'http',
        url: 'https://mcp.example.com/crm',
        targets: ['claude', 'codex', 'antigravity']
      })
    })).json();
    assert.equal(mcpConn.ok, true);
    assert.deepEqual(mcpConn.targets, ['claude', 'codex', 'antigravity']);

    const mcpAfter = await (await fetch(`${running.url}/api/mcp/catalog`)).json();
    const customEntry = mcpAfter.catalog.find(c => c.id === 'custom-crm');
    assert.ok(customEntry);
    assert.equal(customEntry.connectedCount, 3);

    const mcpDisc = await (await fetch(`${running.url}/api/mcp/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'custom-crm', target: 'claude' })
    })).json();
    assert.equal(mcpDisc.ok, true);

    // Self-improve status
    const selfSt = await (await fetch(`${running.url}/api/self/status`)).json();
    assert.ok(selfSt.appRoot);
    assert.ok(selfSt.branch);

    // CORS strict check for brain.ayvu.org -> user's own localhost:4190
    const corsOk = await fetch(`${running.url}/api/info`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://brain.ayvu.org' }
    });
    assert.equal(corsOk.status, 204);
    assert.equal(corsOk.headers.get('access-control-allow-origin'), 'https://brain.ayvu.org');
    assert.equal(corsOk.headers.get('access-control-allow-private-network'), 'true');

    const corsBlocked = await fetch(`${running.url}/api/info`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.invalid' }
    });
    assert.equal(corsBlocked.status, 403);
    assert.equal(corsBlocked.headers.get('access-control-allow-origin'), null);

    const vAdd = await fetch(`${running.url}/api/voice/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Teste de ditado embutido', provider: 'webspeech' })
    });
    assert.equal(vAdd.status, 201);
    const vList = await (await fetch(`${running.url}/api/voice/history`)).json();
    assert.equal(vList.items.length, 1);
    assert.equal(vList.items[0].text, 'Teste de ditado embutido');

    const tree = await (await fetch(`${running.url}/api/vault/tree`)).json();
    assert.ok(tree.notes.some(n => n.path === '_memory/current-state.md'));

    const saveRes = await fetch(`${running.url}/api/vault/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '_memory/current-state.md', content: '# Current State\nUpdated\n' })
    });
    assert.equal(saveRes.status, 200);
    assert.match(await fs.readFile(join(temp, '_memory/current-state.md'), 'utf8'), /Updated/);
  } finally {
    running.server.close();
  }
});
