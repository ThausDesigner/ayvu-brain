# Roteamento e economia de tokens no AYVU Brain

Implementação própria inspirada nos conceitos de [Auto-Combo do OmniRoute](https://github.com/cheaper-inference/OmniRoute/blob/main/docs/routing/AUTO-COMBO.md). Não instala, executa nem depende do OmniRoute. O runtime continua sem dependências npm.

## Usar no aplicativo

1. Abra o AYVU Brain local e entre em **Sistema > Roteamento & consumo**.
2. O padrão permite apenas Claude Code, Codex e Antigravity já instalados. Faça login nas próprias CLIs; a detecção do executável não comprova autenticação.
3. Escolha a estratégia e ajuste a ordem com as setas. Clique em **Salvar preferências** e **Usar no chat**. O seletor passa para **Automático · AYVU Router**.
4. Cada resposta mostra a rota, consumo informado ou estimado e turnos antigos retirados. As últimas tentativas aparecem em Sistema, sem conteúdo das mensagens nem credenciais.

Escolher Claude, Codex ou Gemini diretamente continua usando `/api/cli/chat`, com o contrato anterior. Os controles de economia desta entrega se aplicam às solicitações em Automático e ao gateway.

## Conexões

- CLIs: login oficial existente, incluindo OAuth gerenciado pela própria ferramenta. O Brain não extrai nem transforma tokens de assinatura em chaves de API.
- APIs: OpenAI, Anthropic, Google Gemini, xAI, Groq e OpenRouter. Informe o identificador exato do modelo e a chave na seção de conexão. Várias conexões do mesmo provedor são permitidas.
- Ollama: endpoint local fixo `http://127.0.0.1:11434/v1`. O Ollama e o modelo precisam estar instalados separadamente. Não requer chave.
- OAuth direto: OpenRouter com PKCE S256, verificador mantido no servidor, `state`, cookie HttpOnly/SameSite=Lax e expiração de dez minutos. Prepare a conexão no app local, siga o link e autorize no provedor. A chave resultante fica apenas na memória do servidor. A conta paga pelos créditos usados. [Fluxo oficial](https://openrouter.ai/docs/guides/overview/auth/oauth).

Conexões, segredos, token do gateway, afinidade, preferências, cache e contadores vivem na memória do processo. Recarregar o navegador mantém esse estado; reiniciar o servidor limpa tudo. Não há armazenamento de chaves no vault, em localStorage ou nos arquivos de sessões. Desconectar remove a credencial da memória; para revogar uma chave emitida pelo provedor, use o console dele.

## Estratégias e fallback

| Estratégia | Critério |
| --- | --- |
| Prioridade | Ordem definida pelo usuário, com preferência pela última CLI bem-sucedida da sessão |
| Menor latência | Duração observada nas chamadas desta execução; rotas sem medição vêm depois |
| Menor custo | Estimativa com preços de entrada/saída informados pelo usuário; desconhecido nunca vira zero |
| Alternância | Distribuição sequencial entre as rotas elegíveis |

O roteador tenta até três rotas. APIs permitem fallback em HTTP 429, 502, 503 e 504. O intervalo de recuperação começa em 30 segundos, aumenta com falhas e considera `Retry-After`, com teto de uma hora. 401/403 bloqueiam a conexão até ela ser removida e reconectada. Falha de transporte ou formato não repete a chamada automaticamente porque o consumo é desconhecido.

Para CLIs, só existe fallback quando há confirmação de que o processo não iniciou (`ENOENT`). Após início, timeout, cancelamento ou falha interrompem a solicitação. Uma CLI pode já ter alterado arquivos mesmo sem resposta final. A continuação nativa exige vínculo anterior e permanece na mesma CLI; não transfere sessões entre provedores. O bloqueio de concorrência protege as execuções do roteador no mesmo workspace, sem controlar terminais abertos fora dele.

Arquivos anexados ficam nas CLIs. APIs recebem apenas texto e a nota Markdown explicitamente selecionada. Não há envio silencioso de PDFs, imagens ou arquivos binários.

## Economia e limites

- Estimador de entrada: bytes UTF-8 / 3, arredondados, com margem para mensagens. Não é o tokenizer de cada modelo.
- A mensagem atual e as instruções nunca são truncadas. Se não couberem, o envio é bloqueado.
- O histórico antigo sai em pares completos usuário/assistente até caber. Não há resumo automático por outra IA nem cortes em trechos de código.
- A nota selecionada deve caber inteira. Se não couber, o app pede para trocar a nota ou aumentar o limite.
- As APIs recebem um limite de saída. CLIs não oferecem um teto uniforme; seus contextos internos, ferramentas e raciocínio podem consumir tokens adicionais.
- O consumo confirmado vem dos campos `usage` da API. Sem eles, entrada/saída são estimadas. Leituras de cache da Anthropic e tokens de pensamento do Gemini são incluídos quando informados.
- O orçamento diário usa UTC e reserva entrada estimada + limite de saída antes de cada tentativa, evitando corridas. Falhas com consumo desconhecido descontam a reserva conservadoramente. É um controle do roteador durante esta execução, **não um teto financeiro garantido**; reiniciar limpa o contador.
- Cache opcional: somente respostas completas de API, por cinco minutos, até 50 entradas. A chave inclui conexão, modelo associado, instruções, mensagens, nota e limite de saída. Um hit registra zero tokens novos. Agentes CLI nunca usam cache de resposta.
- APIs pagas ficam bloqueadas até o usuário permitir. A marcação de cota grátis e os preços são declarados pelo usuário; o Brain não descobre saldo de assinaturas nem garante gratuidade do provedor.

O número “tokens evitados” compara o contexto antes/depois da redução. É estimado e não equivale a dinheiro economizado nem mede o contexto que as CLIs carregam autonomamente.

## Gateway local

Em Sistema, copie o token do gateway. A revogação invalida o anterior imediatamente. Endereço padrão do app instalado: `http://127.0.0.1:4190/v1`; a prévia desta branch usa `4193`.

`GET /v1/models` e `POST /v1/chat/completions` exigem `Authorization: Bearer <token-do-gateway>`. O gateway só seleciona conexões de API/Ollama: requisições compatíveis com chat não executam agentes de terminal.

Exemplo de corpo, enviado ao endpoint local:

```json
{
  "model": "auto",
  "messages": [{ "role": "user", "content": "Resuma este texto em três pontos." }],
  "max_tokens": 512
}
```

Modelos de rota: `auto`, `auto/priority`, `auto/fast`, `auto/cheap`, `auto/round-robin` ou ID de conexão `api:...`. Ative o modo APIs ou híbrido antes de usar o gateway. Texto e respostas completas são suportados; `tools`, mensagens multimodais, streaming OpenAI e parâmetros não implementados são recusados, não ignorados. O SSE usado pelo aplicativo continua disponível em `/api/router/chat` para etapas de execução.

## Implementação e verificação

- `src/router.mjs`: conexões, estratégias, intervalos, orçamento, cache, afinidade e métricas.
- `src/router-context.mjs`: seleção de contexto em turnos completos.
- `src/router-providers.mjs`: formatos Anthropic, Gemini e OpenAI compatível.
- `src/router-oauth.mjs`: OAuth PKCE oficial do OpenRouter.
- `public/router-ui.{js,css}`: painel e indicadores integrados ao visual prismático com Lucide.
- `test/router.test.mjs`: falhas, isolamento, orçamento concorrente, cache, OAuth, gateway e adaptadores.
- `scripts/verify-router-ui.mjs`: navegador com vault descartável e executores simulados.

Executar `npm run check`, `node --test`, `npm run test:ui` e `npm run test:router:ui`. Os testes não usam chaves reais, não fazem login em provedores e não enviam prompts a contas pagas. A validação de login e inferência reais depende das conexões escolhidas pelo usuário.

Referências de formato: [Groq](https://console.groq.com/docs/openai), [Ollama](https://docs.ollama.com/api/openai-compatibility), [OpenRouter Chat Completions](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion), [tokens Gemini](https://aistudio.google.com/docs/tokens).
