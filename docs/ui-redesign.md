---
tags: [project, design-system, qa, ayvu]
status: active
agent: codex
created: 2026-11-24
updated: 2026-11-24
---

# Redesign do AYVU Brain

GATE: OPEN 50 (rodada 3 de 3 da skill de design). O relatório completo está em `auditoria-taste.md`. Esse resultado não é aprovação visual automática; parte das verificações depende da estrutura do kit da skill. A última rodada ocorreu antes da mudança final do chat para CLIs. Os checks funcionais abaixo foram executados na implementação final.

## Direção

Software local para operar um segundo cérebro. Ação principal: abrir o workspace. AYVU preto/branco, camadas `#09090b`, `#101012`, `#18181b`, separadores sutis e amber pontual, conforme o fio. Geist na interface, Geist Mono para dados e Geist Serif nos títulos da apresentação. Símbolo oficial preservado. Ícones de interface Lucide, embutidos como SVG, licença incluída.

Os arquivos HTML permanecem independentes, compatíveis com o servidor e a distribuição existentes. Fontes incorporadas para funcionar sem Google Fonts. Nenhum framework ou dependência de execução foi adicionado. Não há imagens raster na interface; as 13 referências são material de consulta, não assets de produção.

Voz da página: português direto, com nomes das ferramentas e limites reais, sem métricas inventadas. A apresentação mostra uma prévia interativa claramente identificada; o app lê os dados reais do vault.

## Referências abertas e aplicação

| Referência | Aplicação |
| --- | --- |
| 01 · Efferd dark | Camadas de fundo, visão geral, separadores e métricas reais |
| 02 · Treasury minimal | Espaçamento e hierarquia dos dados |
| 03 · Sisyphus | Navegação lateral e organização do workspace |
| 04 · Integrações | Cards de disponibilidade das CLIs e configuração opcional de APIs |
| 05 · Sense AI | Estado inicial do chat centralizado |
| 06 · Composer glow | Composer integrado e botão Voice, com amber discreto |
| 07 · Mode dropdown | Modos de resposta e de voz em dropdowns consistentes |
| 08 · Tactile pills | Controles compactos com estados de foco e pressão |
| 09 · Active indicator | Indicador lateral do módulo ativo |
| 10 · Minimal rail | Navegação compacta por ícones |
| 11 · Collapsible Riter | Sidebar expansível, grupos e preferência local |
| 12 · Tree Academy | Árvore de fios e busca global |
| 13 · Tree badges | Contadores, tooltips e estado de seleção |

## Comportamento final

- Chat principal: `GET /api/cli/status` e `POST /api/cli/chat`. Claude, Codex e Antigravity usam a autenticação local. Configuração de vault/worktree, continuação de sessão e anexo de nota. Nova conversa desativa a continuação por padrão.
- Instalação da CLI não comprova autenticação. O erro orienta conferir o login no terminal. O backend pode executar ações com as permissões da própria CLI; não foi adicionada uma sandbox pela interface.
- APIs: apenas em **Sistema > Avançado · APIs opcionais e Grok**, fechado por padrão. Tutorial para os quatro provedores e link do Groq no Voice. As chaves ficam em memória da janela.
- Voice: `Ctrl + Space` inicia/para o ditado dentro do app. Web Speech sem chave por padrão; PT-BR/EN. Insere no cursor do chat, editor ou rascunho. Alta precisão BYOK opcional via backend, com Groq/Gemini/OpenAI. Até dois minutos por gravação e liberação do microfone ao encerrar.
- Histórico: `GET/POST /api/voice/history`, copiar, levar ao chat sem enviar automaticamente ou salvar em `_sessions/`. Memória limitada à sessão do servidor.
- Notas: busca por todas as notas, pastas expansíveis, indicador de alterações, confirmação antes de descartar e Ctrl+S no editor.
- Dropdowns: componente acessível que mantém os selects como contrato de dados. Busca para listas longas, setas, Home/End, Enter, Escape, foco e fechamento ao rolar. Barras de rolagem consistentes em Firefox e Chromium.
- Worktrees: normalização dos caminhos Windows evita listar a pasta principal como worktree removível. A remoção exige confirmação explícita.

## Auditoria das seções

| Área | Visual ou interação |
| --- | --- |
| Hero | Prévia HTML do produto com seis módulos clicáveis |
| Workspace | Tabs acessíveis e painel de produto |
| Provedores | Ícones Lucide, cards e links de configuração |
| Local-first | Diagrama e acordeões |
| Instalação | Terminal, copiar comandos e detalhes expansíveis |
| Rodapé | Marca, produto, recursos, ecossistema, idioma e linha legal |

Animação de entrada e hover discretos. Movimento reduzido mantém todo o conteúdo disponível. A paleta e a estrutura solicitadas pelo Thaus prevaleceram sobre sorteios de paleta ou cenas do kit.

## Verificação de endpoints e testes

`node --test` e `npm run check` passaram com os commits de backend `4efcad1` e `4bd05ef`. Este redesign não altera `src/server.mjs` nem o teste de backend.

`npm run test:ui`: 24 checks passaram. Vault descartável com 145 notas, nove fios e repositório Git próprio. Cobre busca/paleta, notas, contexto, CLIs, BYOK opcional, reuniões, worktrees, voz e histórico. Seis módulos testados em 1440, 1024, 820, 768, 390 e 320 px, sem overflow horizontal. Zero erros JavaScript capturados.

Para executar o QA opcional:

```powershell
npm install --prefix .local/qa playwright --no-save --package-lock=false
npm run test:ui
```

Usa Chrome instalado no Windows. `AYVU_CHROME_PATH` permite outro Chromium; `AYVU_PLAYWRIGHT_MODULE` permite apontar para uma instalação própria do Playwright. Não é uma dependência do aplicativo.

As respostas de CLIs, APIs e reconhecimento são simuladas. Nenhuma mensagem foi enviada às IAs reais, nenhuma chave real foi utilizada e nenhuma chamada paga foi feita. O status real em `http://127.0.0.1:4191/api/cli/status` confirmou as três CLIs instaladas. Fala natural e qualidade de transcrição ainda precisam do teste do Thaus com seu microfone, navegador e login.

Copy-lint: apresentação sem FAIL/WARN; no app, o aviso `copy-stat-strip` identifica os atalhos numéricos 1 a 6 da navegação, mantidos porque representam comandos reais.

## Verificação do instalador Windows

Instalador, launcher e desinstalador preservados. Parser PowerShell: zero erros. Atalhos existentes no Menu Iniciar/Desktop apontam para o projeto; VBS e ícone encontrados. Não foi feita reinstalação nem teste em Windows limpo.

A porta 4190 ainda usa um servidor antigo já aberto. A revisão automática bloqueou a ação de encerrá-lo, sem motivo específico além da política. A prévia completa com backend atualizado está em **http://127.0.0.1:4191/app**. O servidor da prévia foi iniciado pelo Codex; o instalador continua usando a porta padrão 4190. Reiniciar o servidor antigo carrega o código novo.

## Separação das edições

O Second Brain Starter permanece em `Projetos/segundo-cerebro-starter`, com apresentação anterior, idioma inglês padrão e opção português. Só recebeu identificação da edição genérica e documentação da separação. Seus 13 testes, check e empacotamento passaram. O AYVU Brain conserva projeto, identidade e instalador próprios. Nenhuma tag nova ou publicação foi executada.

Evidências locais em `.local/final-*.png` e `.local/qa-results/results.json`, ignoradas pelo Git. Licenças: `font-license.txt` e `lucide-license.txt`.
