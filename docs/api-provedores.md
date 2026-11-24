---
tags: [tutorial, api, ayvu]
status: active
agent: codex
created: 2026-11-24
updated: 2026-11-24
---

# Como obter suas chaves de API

O mesmo tutorial está em **Sistema > Avançado > Como obter suas chaves de API**. Você só precisa criar chaves dos provedores que pretende usar.

O chat principal usa Claude, Codex e Antigravity já autenticados no computador, sem chave. As instruções abaixo são apenas para **Sistema > Avançado · APIs opcionais e Grok** e para transcrição BYOK opcional. No Voice, Web Speech sem chave continua como padrão.

## Claude / Anthropic

1. Entre no [Claude Console](https://platform.claude.com/settings/keys).
2. Em **API keys**, escolha **Create key**, dê um nome e vincule à sua conta ou workspace.
3. Copie a chave quando ela for criada. Confira créditos e cobrança no Console.
4. Em Sistema > Avançado, escolha Claude como provedor de API e preencha **Chave de API**.

A chave completa só aparece na criação. Se perder, crie outra. [Documentação oficial](https://platform.claude.com/docs/en/get-api-key).

## OpenAI / Codex

1. Entre na [plataforma OpenAI](https://platform.openai.com/api-keys) e selecione seu projeto.
2. Em **API keys**, crie uma chave secreta para esse projeto.
3. Copie a chave e confira a cobrança da API.
4. Em Sistema > Avançado, escolha OpenAI / Codex como provedor de API e cole a chave.

A chave completa aparece apenas na criação. [Documentação oficial](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key).

ChatGPT e API têm cobranças separadas, inclusive quando uma assinatura oferece créditos promocionais para a API. Este chat usa API; Codex CLI pode usar sua própria autenticação. [Cobrança da OpenAI](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform).

## Gemini / Google

1. Abra [API Keys no Google AI Studio](https://aistudio.google.com/apikey).
2. Use uma chave existente ou escolha **Create API key** e o projeto.
3. Copie a chave. Confira cota, permissões e faturamento do projeto.
4. Em Sistema > Avançado, escolha Gemini como provedor de API e conecte a chave. Ela também será usada ao transcrever reuniões nesta janela.

Se um projeto existente não aparecer, consulte a opção de importar projetos no AI Studio. [Documentação oficial](https://aistudio.google.com/docs/api-key).

## Grok / xAI

1. Entre no [console da xAI](https://console.x.ai/) e escolha sua equipe.
2. Abra **API Keys** e crie uma chave para usar a API.
3. Copie a chave e confira os créditos da equipe.
4. Em Sistema > Avançado, escolha Grok como provedor de API e preencha a chave.

O console de desenvolvedores é o lugar para criar a chave. [Guia oficial](https://docs.x.ai/developers/quickstart).

## Conferir a conexão

Selecione um modelo disponível na sua conta e envie uma mensagem curta. “Chave configurada” informa apenas que o campo está preenchido. A autenticação só é confirmada quando o provedor responde. Essa chamada pode consumir créditos.

401/403 geralmente pedem revisão da chave e das permissões. Em 429, confira cotas, créditos e limites de requisição. Se o modelo não estiver disponível, ajuste **Modelo** usando um identificador aceito pelo provedor. O app preserva os endpoints existentes e os modelos continuam editáveis.

As chaves ficam na memória desta janela, sem localStorage ou sessionStorage. Recarregar remove as chaves. Não cole segredos em notas, mensagens ou capturas de tela. Para remover uma chave da conta, revogue-a no console do provedor.

## Ditado por voz e Groq

Dentro do app, **Ctrl + Space** inicia ou para o ditado. O botão **Voice** abre a configuração. O texto entra no cursor do Chat, no editor de notas ou no rascunho rápido quando nenhum desses campos está ativo.

**Instantâneo:** usa Web Speech em português ou inglês. Não exige chave. O reconhecimento depende do navegador e pode enviar áudio ao serviço do próprio navegador; não é uma promessa de operação offline. [Referência Web Speech](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

**Alta precisão BYOK:** grava até dois minutos e envia o áudio ao backend local ao parar. Selecione Groq, Gemini ou OpenAI e cole a chave no painel Voice. Gemini e OpenAI também podem aproveitar uma chave já configurada nesta janela.

Para Groq, entre no [console e crie uma chave](https://console.groq.com/keys). O backend usa `whisper-large-v3-turbo`; Gemini usa `gemini-2.5-flash`; OpenAI usa `gpt-4o-mini-transcribe`. [Transcrição Groq](https://console.groq.com/docs/speech-to-text).

O histórico permite copiar, levar o texto ao Chat para revisão ou salvar uma nota em `_sessions/`. Até 30 ditados ficam na memória do servidor. Reiniciar o servidor limpa esse histórico; as notas salvas permanecem no vault.

Fontes conferidas em 24/11/2026. Nenhuma chave real ou chamada paga foi usada na validação automatizada.
