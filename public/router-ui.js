// Uses the app's existing components and Lucide strokes; no third-party runtime.
(() => {
  const icon = name => {
    const paths = { route:'<path d="M9 5h8.5a1 1 0 010 7h-11a1 1 0 000 7H15"/><circle cx="18" cy="19" r="3"/><circle cx="6" cy="5" r="3"/>', up:'<path d="m5 12 7-7 7 7M12 19V5"/>', down:'<path d="m5 12 7 7 7-7M12 5v14"/>', x:'<path d="m18 6-12 12M6 6l12 12"/>' };
    return `<svg class="ico lucide lucide-${name==='route'?'route':name==='up'?'arrow-up':name==='down'?'arrow-down':'x'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
  };
  const panel = document.createElement('section'); panel.className='router-panel'; panel.id='brain-router'; panel.setAttribute('aria-labelledby','router-heading');
  panel.innerHTML=`<div class="router-head"><div><h2 id="router-heading">${icon('route')} Roteamento & consumo</h2><p>Escolha a rota. Envie só o contexto necessário.</p></div><div class="row"><button class="btn sec sm" id="router-refresh">Atualizar</button><button class="btn sm" id="router-use">Usar no chat</button></div></div>
  <div class="router-metrics"><div><strong id="router-requests">0</strong><span>Respostas do roteador</span></div><div><strong id="router-saved">0</strong><span>Tokens de entrada evitados · estimativa</span></div><div><strong id="router-cache-hits">0</strong><span>Respostas reutilizadas</span></div><div><strong id="router-budget">0</strong><span>Tokens contabilizados hoje · UTC</span></div></div>
  <form id="router-settings"><div class="router-grid">
  <label class="field"><span>Rotas permitidas</span><select id="router-mode"><option value="local">CLIs autenticadas</option><option value="api">APIs e Ollama</option><option value="hybrid">CLIs + APIs</option></select></label>
  <label class="field"><span>Escolha da rota</span><select id="router-strategy"><option value="priority">Prioridade + última CLI da sessão</option><option value="fast">Menor latência observada</option><option value="cheap">Menor custo informado</option><option value="round-robin">Alternar entre rotas</option></select></label>
  <label class="field"><span>Entrada máxima · estimativa</span><input id="router-input" type="number" min="256" max="65536" value="4096" required></label>
  <label class="field"><span>Saída máxima · APIs</span><input id="router-output" type="number" min="64" max="16384" value="1024" required></label>
  <label class="field"><span>Limite diário · tokens</span><input id="router-daily" type="number" min="512" max="10000000" value="50000" required></label></div>
  <div class="router-checks"><label><input id="router-optimize" type="checkbox" checked>Reduzir histórico antigo</label><label><input id="router-cache" type="checkbox">Reutilizar respostas idênticas de API por 5 min</label><label><input id="router-paid" type="checkbox">Permitir APIs pagas</label></div>
  <div class="row"><button class="btn sec sm" type="submit">Salvar preferências</button><span id="router-saved-status" role="status"></span></div></form>
  <p>O modo Automático usa estas preferências. Instruções e mensagem atual são preservadas. Conversas antigas saem em pares completos; uma nota grande demais bloqueia o envio para você ajustar o limite. Cache só para APIs, nunca para execução de agentes.</p>
  <p class="router-notice">CLIs podem carregar contexto e ferramentas por conta própria. Seus tokens, cotas e custos reais não são expostos aqui. O limite diário é uma estimativa do tráfego deste roteador, não um teto de cobrança do provedor.</p>
  <h3>Conexões e ordem de prioridade</h3><div id="router-connections"><p>Carregando rotas...</p></div>
  <details><summary>Conectar API ou Ollama</summary><p>Chaves ficam apenas na memória deste servidor local. Reiniciar limpa conexões, preferências e contadores. Recarregar o navegador mantém as conexões do servidor.</p>
  <form id="router-connect"><div class="router-grid">
  <label class="field"><span>Provedor</span><select id="router-provider"><option value="openai">OpenAI</option><option value="claude">Anthropic</option><option value="gemini">Google Gemini</option><option value="grok">xAI / Grok</option><option value="groq">Groq</option><option value="openrouter">OpenRouter</option><option value="ollama">Ollama local</option></select></label>
  <label class="field"><span>Modelo · identificador exato</span><input id="router-model" placeholder="Copie do catálogo do provedor" required maxlength="160" autocomplete="off"></label>
  <label class="field"><span>Nome da conexão</span><input id="router-label" placeholder="Opcional" maxlength="100" autocomplete="off"></label>
  <label class="field"><span>Chave · desnecessária para Ollama</span><input id="router-key" type="password" autocomplete="off"></label>
  <label class="field"><span>USD / milhão de tokens de entrada</span><input id="router-price-in" type="number" min="0" max="100000" step="any" placeholder="Desconhecido"></label>
  <label class="field"><span>USD / milhão de tokens de saída</span><input id="router-price-out" type="number" min="0" max="100000" step="any" placeholder="Desconhecido"></label></div>
  <div class="router-checks"><label><input id="router-free" type="checkbox">Confirmei que este modelo usa uma cota grátis</label></div><button class="btn sec sm" type="submit">Adicionar conexão</button></form>
  <p>Preços e cotas são informados por você. Valor desconhecido não é tratado como grátis. Use os limites de cobrança do provedor para controlar gastos.</p></details>
  <details><summary>Conectar OpenRouter com OAuth</summary><p>Autorize pelo site oficial com PKCE. O OpenRouter cria uma chave para sua conta; confira os limites e a validade na tela de autorização. As chamadas usam seus créditos, não a assinatura das CLIs.</p><form id="router-oauth"><label class="field"><span>Modelo OpenRouter</span><input id="router-oauth-model" placeholder="Identificador do modelo no OpenRouter" maxlength="160" required></label><div class="row" style="margin-top:12px"><button class="btn sec sm" type="submit">Preparar conexão segura</button><a class="btn sec sm hidden" id="router-oauth-authorize" target="_blank" rel="noopener noreferrer">Autorizar no OpenRouter</a></div></form><p id="router-oauth-hint" role="status"></p></details>
  <details><summary>Login e sessões das CLIs</summary><p>Claude, Codex e Antigravity usam o login já feito nos programas oficiais, inclusive OAuth quando suportado. Abra a CLI no terminal para autenticar. O Brain não copia tokens de assinatura para APIs de terceiros.</p><p>“Continuar sessão” em Automático exige uma CLI vinculada por uma resposta anterior nesta sessão. Erros depois do início da execução param a solicitação para evitar repetir alterações. Anexos de arquivos usam somente CLIs; APIs recebem texto e a nota selecionada.</p></details>
  <details><summary>Gateway para outros aplicativos</summary><p>Endpoint local para Chat Completions de texto. Ative o modo APIs ou CLIs + APIs e conecte um provedor. Não executa agentes de terminal. Tools, multimodal e streaming OpenAI ainda não são aceitos.</p><code id="router-endpoint"></code><p>Use modelo <code>auto</code>, <code>auto/fast</code>, <code>auto/cheap</code> ou o ID de uma conexão. O token é separado das chaves dos provedores.</p><div class="row"><button class="btn sec sm" id="router-token-copy">Copiar token do gateway</button><button class="btn sec sm" id="router-token-rotate">Revogar token anterior</button></div></details>
  <details><summary>Últimas rotas e tentativas</summary><div class="router-events" id="router-events"></div></details><div class="callout err hidden" id="router-error" role="alert"></div>`;
  $('advanced-api').before(panel);
  panel.querySelectorAll('select').forEach(enhanceSelect);
  $('router-endpoint').textContent=(LOCAL_API_BASE||location.origin)+'/v1';
  let snapshot;
  const number = value => Number(value || 0).toLocaleString('pt-BR');
  const error = e => { $('router-error').textContent=e.message; $('router-error').classList.remove('hidden'); };
  async function api(path,body,method='POST') {
    const res=await fetch('/api/router/'+path,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'O roteador não respondeu.');return data;
  }
  function render(data,forms=true){
    snapshot=data;
    $('router-requests').textContent=number(data.totals.requests);$('router-saved').textContent='~'+number(data.totals.inputSavedEstimate);$('router-cache-hits').textContent=number(data.totals.cacheHits);$('router-budget').textContent=number(data.budget.used);$('router-budget').nextElementSibling.textContent='Tokens hoje · limite '+number(data.budget.limit)+' / dia UTC';
    if(forms){for(const [id,key] of [['mode','mode'],['strategy','strategy'],['input','maxInputTokens'],['output','maxOutputTokens'],['daily','dailyTokenLimit']])$('router-'+id).value=data.settings[key];for(const [id,key] of [['optimize','optimize'],['cache','cache'],['paid','allowPaid']])$('router-'+id).checked=data.settings[key];}
    const list=$('router-connections');list.replaceChildren();
    const order=id=>{const i=data.settings.order.indexOf(id);return i<0?999:i;};
    const sorted=data.connections.slice().sort((a,b)=>order(a.id)-order(b.id));
    sorted.forEach((c,index)=>{
      const row=document.createElement('div');row.className='router-connection';
      const info=document.createElement('div'),title=document.createElement('b'),detail=document.createElement('small');title.textContent=c.label;
      const stateText=!c.available?'Não instalada':c.health.authFailed?'Credencial recusada · reconecte':c.health.cooldownUntil>Date.now()?'Em recuperação até '+new Date(c.health.cooldownUntil).toLocaleTimeString('pt-BR'):c.health.successes?'Última resposta OK':'Aguardando primeira resposta';
      detail.textContent=stateText+' · '+(c.kind==='cli'?'login da CLI · cota desconhecida':c.model+(c.paid?' · API paga':' · marcada como grátis'))+(c.health.latencyMs!=null?' · '+(c.health.latencyMs/1000).toFixed(1)+'s':'');
      info.append(title,detail);if(c.kind==='api'){const id=document.createElement('small');id.textContent=c.id;info.append(id);}
      const actions=document.createElement('div');actions.className='router-actions';
      for(const [name,offset] of [['up',-1],['down',1]]){const b=document.createElement('button');b.type='button';b.className='icon-btn';b.innerHTML=icon(name);b.setAttribute('aria-label',(offset<0?'Subir ':'Descer ')+c.label);b.disabled=index+offset<0||index+offset>=sorted.length;b.onclick=()=>act(async()=>{const ids=sorted.map(x=>x.id);[ids[index],ids[index+offset]]=[ids[index+offset],ids[index]];render(await api('settings',{order:ids}));});actions.append(b);}
      if(c.kind==='api'){const b=document.createElement('button');b.type='button';b.className='icon-btn';b.innerHTML=icon('x');b.setAttribute('aria-label','Desconectar '+c.label);b.onclick=()=>act(async()=>render(await api('connections/'+encodeURIComponent(c.id),undefined,'DELETE')));actions.append(b);}
      row.append(info,actions);list.append(row);
    });
    const events=$('router-events');events.replaceChildren();if(!data.events.length)events.textContent='Nenhuma requisição pelo roteador ainda.';
    for(const e of data.events){const line=document.createElement('div'),time=document.createElement('time');time.textContent=new Date(e.at).toLocaleTimeString('pt-BR');line.append(time,document.createTextNode(e.route+' · '+e.result+(e.input!=null?' · '+number(e.input)+' entrada / '+number(e.output)+' saída'+(e.estimated?' (estimado)':''):'')));events.append(line);}
  }
  async function act(fn){$('router-error').classList.add('hidden');try{await fn();}catch(e){error(e);}}
  async function refresh(forms=true){render(await api('status',undefined,'GET'),forms);}
  $('router-refresh').onclick=()=>act(()=>refresh());
  $('router-use').onclick=()=>{switchView('chat');$('chat-provider').value='auto';$('chat-provider').dispatchEvent(new Event('change'));$('chat-input').focus();};
  $('router-settings').onsubmit=e=>{e.preventDefault();act(async()=>{render(await api('settings',{mode:$('router-mode').value,strategy:$('router-strategy').value,maxInputTokens:Number($('router-input').value),maxOutputTokens:Number($('router-output').value),dailyTokenLimit:Number($('router-daily').value),optimize:$('router-optimize').checked,cache:$('router-cache').checked,allowPaid:$('router-paid').checked}));$('router-saved-status').textContent='Preferências salvas nesta execução.';});};
  $('router-connect').onsubmit=e=>{e.preventDefault();act(async()=>{const data=await api('connections',{provider:$('router-provider').value,model:$('router-model').value,label:$('router-label').value,apiKey:$('router-key').value,free:$('router-free').checked,inputPrice:$('router-price-in').value,outputPrice:$('router-price-out').value});$('router-key').value='';render(data);toast('Conexão adicionada. Autenticação será verificada ao enviar.');});};
  $('router-token-copy').onclick=()=>act(async()=>{const data=await api('token',{});await navigator.clipboard.writeText(data.token);toast('Token do gateway copiado.');});
  $('router-token-rotate').onclick=()=>act(async()=>{await api('token',{rotate:true});toast('Token anterior revogado. Copie o novo token para seus aplicativos.');});
  $('router-oauth').onsubmit=e=>{e.preventDefault();act(async()=>{
    if(LOCAL_API_BASE){const hint=$('router-oauth-hint');hint.replaceChildren();const a=document.createElement('a');a.href=LOCAL_API_BASE+'/app#system';a.textContent='Abra o app local para concluir a autorização neste navegador.';a.target='_blank';a.rel='noopener noreferrer';hint.append(a);return;}
    const data=await api('oauth/start',{model:$('router-oauth-model').value});const link=$('router-oauth-authorize');link.href=data.url;link.classList.remove('hidden');$('router-oauth-hint').textContent='Abra o link e autorize no provedor. Esta conexão expira em dez minutos.';
  });};
  window.addEventListener('focus',()=>act(()=>refresh(false)));
  window.brainRouting={refresh:()=>act(()=>refresh(false)),renderResult(result){
    const last=$('chat-box').querySelector('.msg.assistant:last-child');if(!last||!result.economy)return;
    const meta=document.createElement('small');meta.className='router-result';
    meta.textContent=(result.cached?'Cache · nenhuma chamada nova. ':result.routeLabel+' · ')+(result.usage?.estimated?'Uso estimado':'Uso informado pela API')+': '+number(result.usage.input)+' entrada / '+number(result.usage.output)+' saída. Contexto reduzido: ~'+number(result.economy.saved)+' tokens'+(result.economy.omittedTurns?' · '+result.economy.omittedTurns+' turno(s) antigo(s) omitido(s)':'')+'.';last.append(meta);
  }};
  act(()=>refresh());
})();
