import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createBrainRouter } from '../src/router.mjs';
import { createRouterOAuth } from '../src/router-oauth.mjs';
import { prepareContext, estimateTokens } from '../src/router-context.mjs';
import { callRouterProvider } from '../src/router-providers.mjs';
import { startAyvuBrainServer } from '../src/server.mjs';

const cliStatus = () => ['claude','codex','agy'].map(id=>({id,installed:true}));
const apiResponse = { reply:'Resposta de teste.', usage:{input:20,output:10,estimated:false} };
const create = overrides => createBrainRouter({ cliStatus, runCli:async p=>({reply:'CLI '+p.engine}), callApi:async()=>apiResponse, ...overrides });
function connect(router, provider='openai', rest={}) { const data=router.connect({provider,model:'test-model',apiKey:'test-only-not-a-real-key',free:true,...rest});return data.connections.at(-1).id; }
const request={prompt:'Olá',cwd:'test-workspace',sessionId:'one'};

test('economia preserva instruções, mensagem atual e blocos completos',()=>{
 const history=[{role:'user',content:'A'.repeat(1000)},{role:'assistant',content:'```js\n'+ 'B'.repeat(1000)+'\n```'},{role:'user',content:'recente'},{role:'assistant',content:'sim'}];
 const result=prepareContext({prompt:'Mantenha 123,45 e este código.',system:'Regra obrigatória',history,maxInputTokens:256});
 assert.equal(result.system,'Regra obrigatória');assert.equal(result.messages.at(-1).content,'Mantenha 123,45 e este código.');assert.equal(result.messages.length,3);assert.equal(result.economy.omittedTurns,1);assert.ok(result.economy.saved>500);
 assert.throws(()=>prepareContext({prompt:'x'.repeat(2000),maxInputTokens:256}),/não serão cortadas/);
 assert.throws(()=>prepareContext({prompt:'ok',history,optimize:false,maxInputTokens:256}),/Ative a economia/);
 assert.ok(estimateTokens('ação')>0);
});
test('nota que não cabe bloqueia o envio e não desaparece silenciosamente',async()=>{
 let calls=0;const r=create({runCli:async()=>{calls++;return apiResponse;}});r.configure({maxInputTokens:256});
 await assert.rejects(r.chat({...request,context:'note '.repeat(500)}),/nota anexada excede/);assert.equal(calls,0);
});
test('modo padrão usa CLI e não invoca API, mesmo configurada',async()=>{
 let api=0;const r=create({callApi:async()=>{api++;return apiResponse;}});connect(r);const result=await r.chat(request);assert.equal(result.engine,'claude');assert.equal(api,0);assert.equal(result.usage.estimated,true);
});
test('fallback de CLI só quando o processo não iniciou',async()=>{
 const calls=[];const r=create({runCli:async p=>{calls.push(p.engine);if(p.engine==='claude')throw Object.assign(new Error('ENOENT'),{safeToRetry:true});return apiResponse;}});
 const d=await r.chat(request);assert.deepEqual(calls,['claude','codex']);assert.equal(d.attempts.length,2);
 const stopped=[];const q=create({runCli:async p=>{stopped.push(p.engine);throw new Error('Changed file, then failed');}});
 await assert.rejects(q.chat(request),/revise o workspace/);assert.deepEqual(stopped,['claude']);
});
test('afinidade e continuar sessão mantêm a CLI; não transferem sessão nativa',async()=>{
 let broken=false;const r=create({runCli:async()=>{if(broken)throw Object.assign(new Error('missing'),{safeToRetry:true});return apiResponse;}});
 await assert.rejects(r.chat({...request,continueSession:true}),/Não há uma CLI vinculada/);
 await r.chat(request);broken=true;
 await assert.rejects(r.chat({...request,continueSession:true}),/CLI não iniciou/);
 assert.equal(r.snapshot().events.filter(e=>e.route==='Codex').length,0);
});
test('rotas pagas exigem opt-in, preço desconhecido não vira zero',async()=>{
 const calls=[];const r=create({callApi:async c=>{calls.push(c.id);return apiResponse;}});const unknown=connect(r,'openai',{free:false});const cheap=connect(r,'groq',{free:false,inputPrice:0.1,outputPrice:0.2});
 r.configure({mode:'api',strategy:'cheap'});await assert.rejects(r.chat(request),/Nenhuma rota elegível/);
 r.configure({allowPaid:true});const result=await r.chat(request);assert.deepEqual(calls,[cheap]);assert.notEqual(result.route,unknown);assert.ok(result.costEstimateUsd>0);
});
test('429 respeita cooldown, faz fallback limitado e retesta após recuperação',async()=>{
 let clock=100000;const calls=[];let first;const r=create({now:()=>clock,callApi:async c=>{calls.push(c.id);if(c.id===first)throw Object.assign(new Error('quota'),{status:429,retryAfterMs:60000});return apiResponse;}});first=connect(r);const second=connect(r,'groq');r.configure({mode:'api'});
 const d=await r.chat(request);assert.equal(d.route,second);assert.equal(d.attempts.length,2);assert.equal(r.snapshot().connections.find(c=>c.id===first).health.cooldownUntil,160000);
 await r.chat(request);assert.deepEqual(calls,[first,second,second]);clock+=61000;await r.chat(request);assert.deepEqual(calls.slice(-2),[first,second]);
});
test('erro de autenticação bloqueia conexão sem vazar erro do provedor',async()=>{
 const r=create({callApi:async()=>{throw Object.assign(new Error('secret in body'),{status:401});}});connect(r);r.configure({mode:'api'});
 await assert.rejects(r.chat(request),/HTTP 401/);assert.equal(r.snapshot().connections.at(-1).health.authFailed,true);assert.doesNotMatch(JSON.stringify(r.snapshot()),/secret in body|test-only-not-a-real-key|apiKey/);
});
test('cache exato inclui contexto, conta uso zero e nunca reutiliza execução CLI',async()=>{
 let calls=0;const r=create({callApi:async()=>{calls++;return apiResponse;}});connect(r);r.configure({mode:'api',cache:true});await r.chat(request);const cached=await r.chat(request);assert.equal(cached.cached,true);assert.equal(cached.usage.input,0);assert.equal(calls,1);await r.chat({...request,context:'novo contexto'});assert.equal(calls,2);
 let cli=0;const q=create({runCli:async()=>{cli++;return apiResponse;}});q.configure({cache:true});await q.chat(request);await q.chat(request);assert.equal(cli,2);
});
test('reserva de orçamento bloqueia corrida de requisições simultâneas',async()=>{
 let release;const r=create({callApi:()=>new Promise(resolve=>{release=resolve;})});connect(r);r.configure({mode:'api',maxOutputTokens:400,dailyTokenLimit:700});
 const first=r.chat(request);await assert.rejects(r.chat(request),/Limite diário/);release(apiResponse);await first;assert.equal(r.snapshot().budget.reserved,0);assert.equal(r.snapshot().budget.used,30);
});
test('gateway nunca seleciona CLI e anexos nunca vão para APIs',async()=>{
 const r=create();connect(r);r.configure({mode:'hybrid'});const d=await r.chat({...request,apiOnly:true});assert.ok(d.route.startsWith('api:'));
 const local=await r.chat({...request,attachments:[{name:'note'}]});assert.ok(local.route.startsWith('cli:'));
});
test('alternância percorre rotas e latência observada escolhe menor tempo',async()=>{
 let clock=0;const r=create({now:()=>clock,runCli:async p=>{clock+=p.engine==='claude'?100:10;return apiResponse;}});r.configure({strategy:'round-robin'});
 assert.equal((await r.chat(request)).engine,'claude');assert.equal((await r.chat(request)).engine,'codex');r.configure({strategy:'fast'});assert.equal((await r.chat(request)).engine,'codex');
});
test('token rotaciona e configurações inválidas não mutam estado',()=>{
 const r=create();const t=r.token();assert.equal(r.validateToken(t),true);r.token(true);assert.equal(r.validateToken(t),false);
 assert.throws(()=>r.configure({maxOutputTokens:Infinity}),/inválido/);assert.equal(r.snapshot().settings.maxOutputTokens,1024);
 assert.throws(()=>connect(r,'inventado'),/suportado/);
});
test('OAuth PKCE verifica navegador, expiração e uso único sem expor a chave',async()=>{
 let clock=0,connected,exchange;
 const oauth=createRouterOAuth({now:()=>clock,connect:c=>{connected=c;},fetchImpl:async(url,opts)=>{exchange=JSON.parse(opts.body);return new Response(JSON.stringify({key:'oauth-test-key'}));}});
 const start=oauth.begin({model:'provider/model',origin:'http://127.0.0.1:4193'});const url=new URL(start.url),state=url.searchParams.get('state');
 assert.equal(url.origin,'https://openrouter.ai');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.has('code_verifier'),false);
 await assert.rejects(oauth.finish({state,code:'code',nonce:'wrong'}),/outro navegador/);
 const result=await oauth.finish({state,code:'code',nonce:start.nonce});assert.deepEqual(result,{ok:true});assert.equal(connected.apiKey,'oauth-test-key');assert.equal(connected.free,false);assert.ok(exchange.code_verifier);assert.equal(exchange.code_challenge_method,'S256');
 await assert.rejects(oauth.finish({state,code:'code',nonce:start.nonce}),/expirada/);
 const expires=oauth.begin({model:'provider/model',origin:'http://localhost:4193'});clock=600001;await assert.rejects(oauth.finish({state:new URL(expires.url).searchParams.get('state'),code:'code',nonce:expires.nonce}),/expirada/);
 assert.throws(()=>oauth.begin({model:'m',origin:'https://evil.example'}),/localhost/);
});
test('adaptadores enviam limites, normalizam uso e ocultam corpo de erro',async()=>{
 const prepared=prepareContext({prompt:'Olá',system:'Instrução'});
 for(const provider of ['openai','claude','gemini','groq','grok','openrouter','ollama']){
  let sent;const response=provider==='claude'?{content:[{type:'text',text:'ok'}],usage:{input_tokens:4,output_tokens:2}}:provider==='gemini'?{candidates:[{content:{parts:[{text:'ok'}]}}],usageMetadata:{promptTokenCount:4,candidatesTokenCount:2}}:{choices:[{message:{content:'ok'}}],usage:{prompt_tokens:4,completion_tokens:2}};
  const result=await callRouterProvider({provider,model:'model',apiKey:'fake'},prepared,{maxOutputTokens:128,fetchImpl:async(url,opts)=>{sent={url,headers:opts.headers,body:JSON.parse(opts.body)};return new Response(JSON.stringify(response));}});
  assert.equal(result.reply,'ok');assert.equal(result.usage.input,4);assert.equal(provider==='gemini'?sent.body.generationConfig.maxOutputTokens:sent.body.max_completion_tokens||sent.body.max_tokens,128);
  assert.ok(!sent.url.includes('fake'));
 }
 await assert.rejects(callRouterProvider({provider:'openai',model:'model',apiKey:'fake'},prepared,{maxOutputTokens:100,fetchImpl:async()=>new Response('secret echoed',{status:429,headers:{'retry-after':'20'}})}),e=>e.status===429&&e.retryAfterMs===20000&&!e.message.includes('secret'));
});
test('HTTP protege token/origem, serve gateway e contexto validado com SSE',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ayvu-router-test-'));let seen;
 await mkdir(join(root,'_memory'));await writeFile(join(root,'_memory/note.md'),'Contexto local confiável como dado.');
 const running=await startAyvuBrainServer({vaultRoot:root,port:0,routerOAuthFetch:async()=>new Response(JSON.stringify({key:'mock-oauth-key'})),routerAdapters:{cliStatus,runCli:async p=>{seen=p;return apiResponse;},callApi:async()=>apiResponse}});
 const json=(path,body,headers={})=>fetch(running.url+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 try{
  assert.equal((await fetch(running.url+'/v1/models')).status,401);
  assert.equal((await json('/api/router/token',{}, {Origin:'https://evil.example'})).status,403);
  const token=(await(await json('/api/router/token',{})).json()).token;const auth={Authorization:'Bearer '+token};
  assert.equal((await fetch(running.url+'/v1/models',{headers:auth})).status,200);
  const c=await json('/api/router/connections',{provider:'groq',model:'test',apiKey:'not-real',free:true});assert.equal(c.status,201);
  await json('/api/router/settings',{mode:'hybrid'});
  const gateway=await json('/v1/chat/completions',{model:'auto',messages:[{role:'user',content:'hello'}]},auth);assert.equal(gateway.status,200);const data=await gateway.json();assert.equal(data.choices[0].message.content,apiResponse.reply);
  assert.equal((await json('/v1/chat/completions',{messages:[{role:'user',content:'hi'}],stream:true},auth)).status,400);
  const stream=await json('/api/router/chat',{prompt:'Olá',contextPath:'_memory/note.md'},{Accept:'text/event-stream'});const text=await stream.text();assert.match(text,/event: done/);assert.match(seen.prompt,/Contexto local/);
  assert.equal((await json('/api/router/chat',{prompt:'x',contextPath:'../forbidden'})).status,400);
  assert.equal((await fetch(running.url+'/router-ui.js')).status,200);
  const oauthStart=await json('/api/router/oauth/start',{model:'test/model'});const cookie=oauthStart.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Lax/);
  const authUrl=new URL((await oauthStart.json()).url);const callback=running.url+'/api/router/oauth/callback?state='+authUrl.searchParams.get('state')+'&code=mock-code';
  const returned=await fetch(callback,{headers:{Cookie:cookie.split(';')[0]},redirect:'manual'});assert.equal(returned.status,303);assert.equal(returned.headers.get('location'),'/app#system');
  assert.equal((await fetch(callback,{headers:{Cookie:cookie.split(';')[0]},redirect:'manual'})).status,400);
  assert.doesNotMatch(JSON.stringify(await(await fetch(running.url+'/api/router/status')).json()),/mock-oauth-key/);
 }finally{await new Promise(resolve=>running.server.close(resolve));await rm(root,{recursive:true,force:true});}
});
