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

  const running = await startAyvuBrainServer({ vaultRoot: temp, port: 0 });
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

    const cliStatus = await (await fetch(`${running.url}/api/cli/status`)).json();
    assert.equal(cliStatus.engines.length, 3);
    assert.deepEqual(cliStatus.engines.map(e => e.id), ['claude', 'codex', 'agy']);

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
