// Optional browser QA. Install with: npm install --prefix .local/qa playwright --no-save --package-lock=false
// Runs against a disposable vault. No personal files, real API keys or paid requests are used.
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { startAyvuBrainServer } from '../src/server.mjs';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
let chromium;
try{({chromium}=await import(process.env.AYVU_PLAYWRIGHT_MODULE||pathToFileURL(join(root,'.local/qa/node_modules/playwright/index.mjs')).href));}
catch{throw new Error('Instale o Playwright de QA: npm install --prefix .local/qa playwright --no-save --package-lock=false');}
const executablePath=process.env.AYVU_CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const temp=await fs.mkdtemp(join(tmpdir(),'ayvu-ui-'));
let browser,running;
const results=[],errors=[];
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS',name);};
try{
 for(const p of ['_memory','_knowledge','_sync/fios','_sessions','Projetos/demo'])await fs.mkdir(join(temp,p),{recursive:true});
 await fs.writeFile(join(temp,'_memory/current-state.md'),'# Estado atual\n\nValidar o workspace.\n');
 for(let i=0;i<145;i++)await fs.writeFile(join(temp,`_knowledge/nota-${String(i).padStart(3,'0')}.md`),`# Nota ${i}\n\nConteúdo de teste.\n`);
 for(let i=0;i<9;i++)await fs.writeFile(join(temp,`_sync/fios/fio-${i}.md`),`---\nstatus: ativo\nem_uso_por: ${i===0?'codex':''}\nupdated: 2026-11-24\n---\n# Fio: Projeto ${i}\n`);
 const repo=join(temp,'Projetos/demo');
 for(const args of [['init'],['-c','user.name=QA','-c','user.email=qa@example.invalid','commit','--allow-empty','-m','fixture']])assert.equal(spawnSync('git',args,{cwd:repo,encoding:'utf8'}).status,0);
 const mcpDir=join(temp,'mcp-home');
 const mcpPaths={claudeJson:join(mcpDir,'.claude.json'),claudeSettings:join(mcpDir,'.claude','settings.json'),codexToml:join(mcpDir,'.codex','config.toml'),agyMcpConfig:join(mcpDir,'.gemini','antigravity','mcp_config.json'),agyMcpDir:join(mcpDir,'.gemini','antigravity','mcp'),agyPluginsDir:join(mcpDir,'.gemini','config','plugins')};
 await fs.mkdir(join(mcpDir,'.codex'),{recursive:true});
 await fs.writeFile(mcpPaths.codexToml,'[mcp_servers.github]\nurl = "https://api.githubcopilot.com/mcp/"\n');
 running=await startAyvuBrainServer({vaultRoot:temp,worktreeRoot:join(temp,'worktrees'),mcpPaths,port:0});
 browser=await chromium.launch({executablePath,headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/cli/status',r=>r.fulfill({json:{engines:[{id:'claude',label:'Claude Code',installed:true},{id:'codex',label:'OpenAI Codex',installed:true},{id:'agy',label:'Gemini (Antigravity)',installed:false}]}}));
 await page.goto(running.url+'/app');await page.waitForFunction(()=>document.getElementById('stat-notes').textContent==='155');
 await check('tela de cadastro/login bloqueia acesso sem sessao com Google e GitHub',async()=>{assert.equal(await page.locator('#auth-gate').isVisible(),true);assert.equal(await page.locator('#auth-google').isVisible(),true);assert.equal(await page.locator('#auth-github').isVisible(),true);await page.evaluate(()=>{localStorage.setItem('ayvu-brain-auth-session',JSON.stringify({access_token:'qa-token',expires_at:Date.now()+3600000,user:{id:'qa-user',email:'qa@ayvu.org',user_metadata:{full_name:'Thaus QA'},app_metadata:{provider:'github'}}}));});await page.reload();await page.waitForFunction(()=>document.getElementById('stat-notes').textContent==='155');assert.equal(await page.locator('#auth-gate').isVisible(),false);assert.match(await page.locator('#user-name').textContent(),/Thaus QA/);});
 await check('barra superior com 7 modulos lado a lado na mesma linha',async()=>{const boxes=await page.locator('.nav.top-nav button').evaluateAll(els=>els.map(e=>e.getBoundingClientRect()));assert.equal(boxes.length,7);for(let i=1;i<boxes.length;i++){assert.ok(Math.abs(boxes[i].y-boxes[0].y)<4,`item ${i} desalinhado verticalmente`);assert.ok(boxes[i].x>boxes[i-1].x,`item ${i} nao esta a direita do anterior`);}});
 await check('dados reais, fios paginados e expansão',async()=>{assert.equal(await page.locator('.thread-row').count(),6);await page.getByRole('button',{name:'Ver todos os 9 fios'}).click();assert.equal(await page.locator('.thread-row').count(),9);await page.getByRole('button',{name:'Mostrar menos'}).click();});
 await check('sidebar recolhe, expande e preserva preferência',async()=>{await page.locator('#collapse-sidebar').click();assert.match(await page.locator('body').getAttribute('class'),/collapsed/);await page.reload();await page.waitForFunction(()=>document.body.classList.contains('collapsed'));await page.locator('#expand-sidebar').click();assert.doesNotMatch(await page.locator('body').getAttribute('class')||'',/collapsed/);});
 await check('paleta por teclado, busca, resultado vazio e retorno de foco',async()=>{await page.locator('#open-palette').focus();await page.keyboard.press('Control+k');await page.locator('#palette-input').fill('nota-144');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.getElementById('editor-path').textContent.includes('nota-144'));await page.keyboard.press('Control+k');await page.locator('#palette-input').fill('inexistente-xyz');assert.match(await page.locator('#palette-list').textContent(),/Nenhuma/);await page.keyboard.press('Escape');assert.equal(await page.locator('#palette-bg').evaluate(n=>n.classList.contains('open')),false);});
 await check('editar e salvar nota com Ctrl+S',async()=>{await page.locator('#note-editor').fill('# Nota 144\n\nEditada pelo QA.\n');await page.keyboard.press('Control+s');await page.waitForFunction(()=>document.getElementById('editor-status').textContent==='Salvo no vault');assert.match(await fs.readFile(join(temp,'_knowledge/nota-144.md'),'utf8'),/Editada pelo QA/);});
 await check('anexar nota entre as 145 disponíveis',async()=>{await page.locator('#btn-send-chat').click();assert.equal(await page.locator('#chat-context').inputValue(),'_knowledge/nota-144.md');assert.match(await page.locator('#chat-context-trigger').textContent(),/nota-144/);});
 await check('dropdown com busca, seleção e Escape',async()=>{await page.locator('#attach-note').click();await page.getByRole('textbox',{name:'Buscar Contexto'}).fill('nota-143');await page.keyboard.press('Enter');assert.equal(await page.locator('#chat-context').inputValue(),'_knowledge/nota-143.md');await page.locator('#chat-provider-trigger').click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await page.locator('#chat-provider').inputValue(),'codex');await page.locator('#chat-provider-trigger').click();await page.keyboard.press('Escape');assert.equal(await page.locator('.dropdown-popup').count(),0);});

 await check('chat principal sem chave e APIs fechadas em Sistema',async()=>{assert.equal(await page.locator('#chat-key').isVisible(),false);assert.equal(await page.locator('#chat-model').isVisible(),false);assert.equal(await page.locator('#advanced-api').getAttribute('open'),null);});
 let payload;await page.route('**/api/cli/chat',async route=>{payload=route.request().postDataJSON();await new Promise(r=>setTimeout(r,80));await route.fulfill({json:{reply:'## Perguntas iniciais\n\n- Ponto principal de contexto\n- [ ] Confirmar escopo do MVP\n- [ ] Validar design no navegador',engine:'codex',cwd:repo,durationMs:80}});});
 await check('chat local usa CLI, auto-save no vault, checklists e anexo sem chave',async()=>{await page.locator('#open-chat-config').click();await page.locator('#cli-cwd').evaluate(el=>el.value=el.options[1].value);await page.locator('#cli-continue').check();await page.locator('#close-chat-config').click();await page.locator('#chat-input').fill('Teste de contexto');await page.locator('#btn-send').click();await page.waitForSelector('.msg.assistant');assert.equal(payload.engine,'codex');assert.equal(payload.contextPath,'_knowledge/nota-143.md');assert.equal(payload.continueSession,true);assert.ok(payload.cwd.includes('demo'));assert.equal(payload.prompt,'Teste de contexto');assert.equal(Object.hasOwn(payload,'apiKey'),false);assert.equal(await page.locator('.msg.user').count(),1);assert.equal(await page.locator('.md-check-item').count(),2);await page.locator('.md-check-item input[type=checkbox]').first().check();await page.getByRole('button',{name:'Responder com selecionados'}).click();assert.match(await page.locator('#chat-input').inputValue(),/Confirmar escopo do MVP/);await page.locator('#chat-input').fill('');await page.waitForFunction(()=>Number(document.getElementById('sessions-count').textContent)>=1);assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.includes('key'))||sessionStorage.length>0),false);});
 await check('upload de arquivo qualquer tipo fica salvo na sessao',async()=>{await page.locator('#chat-file-input').setInputFiles({name:'spec-qa.csv',mimeType:'text/csv',buffer:Buffer.from('col1,col2\n1,2\n')});await page.waitForSelector('.att-chip');assert.match(await page.locator('.att-chip').first().textContent(),/spec-qa\.csv/);});
 await check('erro de CLI permite tentar novamente sem duplicar histórico',async()=>{await page.unroute('**/api/cli/chat');await page.route('**/api/cli/chat',r=>r.fulfill({status:400,json:{error:'Falha CLI simulada'}}));await page.locator('#chat-input').fill('Tente novamente');await page.locator('#btn-send').click();await page.waitForFunction(()=>document.getElementById('chat-err').textContent.includes('Falha CLI simulada'));assert.equal(await page.locator('#chat-input').inputValue(),'Tente novamente');assert.equal(await page.locator('.msg.user').count(),1);});
 await check('CLI ausente informa instalação sem pedir API key',async()=>{await page.locator('#chat-provider').evaluate(el=>{el.value='agy';el.dispatchEvent(new Event('change'));});await page.locator('#btn-send').click();assert.match(await page.locator('#chat-err').textContent(),/não está instalada/);assert.equal(await page.locator('#chat-key').isVisible(),false);await page.locator('#chat-provider').evaluate(el=>{el.value='codex';el.dispatchEvent(new Event('change'));});});
 await check('catalogo MCP vasculha CLIs e permite conexao manual',async()=>{await page.getByRole('button',{name:'MCPs',exact:true}).click();await page.waitForSelector('.mcp-card');assert.ok((await page.locator('.mcp-card').count())>=25);await page.locator('#btn-mcp-manual').click();await page.locator('#mcp-in-name').fill('qa-mcp-server');await page.locator('#mcp-in-url').fill('https://mcp.qa.invalid/mcp');await page.locator('#submit-mcp-modal').click();await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('qa-mcp-server'));});
 await check('BYOK opcional e tutorial ficam em Sistema avançado',async()=>{await page.evaluate(()=>switchView('system'));await page.locator('#advanced-api').evaluate(el=>el.open=true);await page.locator('[data-provider="openai"]').click();await page.locator('#open-api-guide').click();assert.equal(await page.locator('#guide-openai').getAttribute('open'),'');await page.locator('#guide-openai [data-connect]').click();assert.equal(await page.locator('#chat-key').isVisible(),true);assert.equal(await page.locator('#api-provider').inputValue(),'openai');});
 await check('API opcional mantém contrato existente',async()=>{let apiPayload;await page.route('**/api/ai/chat',async r=>{apiPayload=r.request().postDataJSON();await r.fulfill({json:{reply:'Resposta opcional de QA.'}});});await page.locator('#chat-key').fill('qa-not-a-real-key');await page.locator('#advanced-input').fill('Teste opcional');await page.locator('#advanced-send').click();await page.waitForFunction(()=>document.getElementById('advanced-output').textContent==='Resposta opcional de QA.');assert.equal(apiPayload.provider,'openai');assert.equal(apiPayload.messages[0].content,'Teste opcional');});
 await check('reunião sem API: falantes, lista de gravações na barra esquerda, apagar por opções e em lote',async()=>{await page.getByRole('button',{name:'Reuniões',exact:true}).click();assert.equal(await page.locator('#btn-meet-cli').count(),1);assert.equal(await page.locator('#btn-meet-gemini').count(),0);assert.equal(await page.locator('#dock-recordings').isVisible(),true);await page.locator('#meet-speaker-input').fill('Carlos');await page.locator('#btn-add-speaker').click();assert.match(await page.locator('#meet-speakers-bar').textContent(),/Carlos/);await page.locator('#meet-title').fill('Reunião QA');await page.locator('#meet-notes').fill('Decisão de teste.');await page.locator('#btn-meet-manual').click();assert.match(await page.locator('#meet-output').inputValue(),/Decisão de teste/);assert.match(await page.locator('#meet-output').inputValue(),/Carlos/);await page.locator('#btn-meet-save').click();await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Reunião salva'));const files=(await fs.readdir(join(temp,'_sessions'))).filter(f=>f.endsWith('.md'));assert.equal(files.length,1);for(const n of ['Call 1','Call 2','Call 3']){await fetch(running.url+'/api/recordings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:n,mimeType:'video/webm',duration:'01:10',dataBase64:Buffer.from('webm-'+n).toString('base64')})});}await page.evaluate(()=>loadRecordings());await page.waitForFunction(()=>document.querySelectorAll('.rec-item').length===3);await page.locator('.rec-opt-btn').first().click();await page.locator('.rec-opt-menu .danger-item').click();await page.waitForFunction(()=>document.querySelectorAll('.rec-item').length===2);await page.locator('.rec-item .rec-check').nth(0).check();await page.locator('.rec-item .rec-check').nth(1).check();assert.equal(await page.locator('#rec-bulk-bar').isVisible(),true);await page.locator('#btn-rec-bulk-delete').click();await page.waitForFunction(()=>document.querySelectorAll('.rec-item').length===0);});
 await check('agentes criam worktree e mostram diff em repositório descartável',async()=>{await page.getByRole('button',{name:'Agentes & Git',exact:true}).click();await page.locator('#ag-task').fill('ui-qa');await page.locator('#btn-create-wt').click();await page.waitForFunction(()=>document.getElementById('ag-msg').textContent.includes('Criado:'));await page.locator('#ag-repos').getByRole('button',{name:'Diff',exact:true}).first().click();await page.locator('#ag-diff-card').waitFor({state:'visible'});});
 await check('sete módulos sem overflow em seis larguras',async()=>{for(const [width,height] of [[1440,900],[1024,768],[820,1180],[768,1024],[390,844],[320,740]]){await page.setViewportSize({width,height});for(const name of ['overview','vault','chat','mcp','meetings','agents','system']){await page.evaluate(name=>switchView(name),name);const overflow=await page.evaluate(()=>{const el=document.querySelector('.view.active'),vp=document.querySelector('.viewport');return {body:document.documentElement.scrollWidth>innerWidth+1,view:el.scrollWidth>el.clientWidth+2,viewport:vp.scrollWidth>vp.clientWidth+2};});assert.deepEqual(overflow,{body:false,view:false,viewport:false},width+' '+name+' '+JSON.stringify(overflow));}}});
 await page.setViewportSize({width:1440,height:900});await page.goto(running.url+'/app#system');await page.reload();await page.waitForFunction(()=>document.getElementById('top-status').textContent==='Workspace local');
 await check('recarregar elimina chaves e preserva navegação por hash',async()=>{assert.equal(await page.locator('#view-system').isVisible(),true);assert.equal(await page.locator('.provider-card.connected').count(),0);});
 await page.evaluate(()=>{
  class FakeRecognition{
   start(){window.qaRecognition=this;}
   stop(){this.onend?.();}
   abort(){this.onend?.();}
  }
  window.SpeechRecognition=FakeRecognition;
 });
 await check('voz inline no chat: sem popup, barra ativa e escreve direto no cursor',async()=>{
  await page.evaluate(()=>switchView('chat'));await page.locator('#chat-input').fill('Antes depois');await page.locator('#chat-input').evaluate(el=>{el.focus();el.setSelectionRange(5,5);});
  await page.locator('#voice-trigger').click();await page.waitForFunction(()=>window.qaRecognition);
  assert.equal(await page.locator('#voice-panel').isVisible(),false);
  assert.equal(await page.locator('#chat-voice-bar').isVisible(),true);
  assert.equal(await page.evaluate(()=>window.qaRecognition.lang),'pt-BR');
  await page.evaluate(()=>{const result=[{transcript:'texto ditado'}];result.isFinal=true;window.qaRecognition.onresult({resultIndex:0,results:[result]});});
  assert.match(await page.locator('#chat-input').inputValue(),/Antes texto ditado depois/);
  await page.locator('#chat-voice-stop').click();await page.waitForFunction(()=>document.getElementById('voice-history-count').textContent==='1');
  assert.equal(await page.locator('#chat-voice-bar').isVisible(),false);
  const history=await (await fetch(running.url+'/api/voice/history')).json();assert.equal(history.items[0].text,'texto ditado');
 });
 await check('voz: histórico leva ao chat e salva em _sessions',async()=>{
  await page.evaluate(()=>openVoice());
  await page.locator('#voice-history').evaluate(el=>el.open=true);await page.locator('#voice-history-list').getByRole('button',{name:'Salvar nota',exact:true}).first().click();
  await page.waitForFunction(()=>document.getElementById('toast').textContent.startsWith('Salvo em'));
  assert.equal((await fs.readdir(join(temp,'_sessions'))).filter(f=>f.endsWith('.md')).length,2);
  await page.locator('#voice-history-list').getByRole('button',{name:'Levar ao chat',exact:true}).first().click();assert.equal(await page.locator('#chat-input').inputValue(),'texto ditado');assert.equal(await page.locator('#voice-panel').isVisible(),false);
 });
 await check('voz: ditado no editor ativa alterações não salvas',async()=>{
  await page.evaluate(()=>openNote('_knowledge/nota-144.md'));await page.locator('#note-editor').focus();await page.keyboard.press('Control+Space');await page.waitForFunction(()=>document.getElementById('voice-panel').classList.contains('recording'));
  await page.evaluate(()=>{const result=[{transcript:'Complemento por voz.'}];result.isFinal=true;window.qaRecognition.onresult({resultIndex:0,results:[result]});});await page.keyboard.press('Control+Space');
  assert.match(await page.locator('#note-editor').inputValue(),/Complemento por voz/);assert.equal(await page.locator('#editor-status').textContent(),'Alterações não salvas');await page.locator('#voice-close').click();await page.locator('#btn-save-note').click();
 });
 await check('voz: idioma EN, falta de suporte e configuração BYOK',async()=>{
  await page.locator('#voice-system-open').evaluate(el=>{switchView('system');el.click();});await page.locator('#voice-language').evaluate(el=>{el.value='en-US';el.dispatchEvent(new Event('change'));});await page.locator('#voice-start').click();assert.equal(await page.evaluate(()=>window.qaRecognition.lang),'en-US');await page.locator('#voice-start').click();
  await page.evaluate(()=>{delete window.SpeechRecognition;window.webkitSpeechRecognition=undefined;});await page.locator('#voice-start').click();assert.match(await page.locator('#voice-error').textContent(),/não oferece Web Speech/);
  await page.locator('#voice-mode').evaluate(el=>{el.value='byok';el.dispatchEvent(new Event('change'));});await page.locator('#voice-start').click();assert.match(await page.locator('#voice-error').textContent(),/Conecte a chave/);
 });
 let voicePayload;
 await page.route('**/api/voice/transcribe',async route=>{voicePayload=route.request().postDataJSON();await route.fulfill({json:{text:'Ditado BYOK de teste.',provider:'groq',model:'whisper-large-v3-turbo'}});});
 await page.evaluate(()=>{
  navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop(){window.qaTrackStopped=true;}}]});
  window.MediaRecorder=class{
   static isTypeSupported(){return true;}
   constructor(){this.mimeType='audio/webm';this.state='inactive';}
   start(){this.state='recording';}
   stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['qa-audio'],{type:'audio/webm'})});this.onstop?.();}
  };
 });
 await check('voz BYOK envia contrato correto, limpa microfone e insere rascunho',async()=>{
  await page.locator('#voice-draft').fill('');await page.locator('#voice-draft').focus();await page.locator('#voice-key').fill('qa-voice-not-a-real-key');await page.locator('#voice-start').click();await page.waitForFunction(()=>document.getElementById('voice-panel').classList.contains('recording'));await page.locator('#voice-start').click();await page.waitForFunction(()=>document.getElementById('voice-status').textContent==='Ditado inserido no destino.');
  assert.equal(voicePayload.provider,'groq');assert.equal(voicePayload.language,'en-US');assert.equal(voicePayload.mimeType,'audio/webm');assert.equal(Buffer.from(voicePayload.audioBase64,'base64').toString(),'qa-audio');assert.equal(await page.evaluate(()=>window.qaTrackStopped),true);assert.equal(await page.locator('#voice-draft').inputValue(),'Ditado BYOK de teste.');
  await page.locator('#voice-close').click();
 });
 await check('voz: painel e dropdowns cabem em 320px',async()=>{await page.setViewportSize({width:320,height:740});await page.evaluate(()=>{switchView('system');openVoice();});assert.equal(await page.locator('#voice-panel').evaluate(el=>el.scrollWidth>el.clientWidth+2),false);await page.locator('#voice-provider-trigger').click();const box=await page.locator('.dropdown-popup').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=321);await page.keyboard.press('Escape');await page.locator('#voice-close').click();});
 await check('landing: tabs, prévia, menu e links locais',async()=>{await page.goto(running.url);await page.getByRole('tab',{name:/Multi-IA Chat/}).click();assert.match(await page.locator('#module-open').getAttribute('href'),/#chat/);await page.keyboard.press('ArrowDown');assert.match(await page.locator('#module-open').getAttribute('href'),/#meetings/);await page.locator('[data-demo="agents"]').click();assert.match(await page.locator('#hero-demo').textContent(),/Cada tarefa/);for(const width of [1440,1024,820,768,390,320]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'landing '+width);}await page.locator('#menu-toggle').click();assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'true');await page.locator('.nav-links a[href="#instalar"]').click();assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'false');});
 await check('zero erros JavaScript no navegador',async()=>assert.deepEqual(errors,[]));
 await fs.mkdir(join(root,'.local/qa-results'),{recursive:true});
 await fs.writeFile(join(root,'.local/qa-results/results.json'),JSON.stringify({date:new Date().toISOString(),results,errors},null,2));
 console.log('UI QA:',results.length,'checks passed.');
}finally{
 await browser?.close();if(running)await new Promise(r=>running.server.close(r));
 const rel=resolve(temp);assert.ok(rel.startsWith(resolve(tmpdir()))&&rel.includes('ayvu-ui-'));await fs.rm(rel,{recursive:true,force:true});
}
