# Contexto da conversa de Enrichment para o dev agent

Data: 2026-08-02 · Status: aprovado (sem questões em aberto)

## Problema

A coluna Enrichment (`chat: true`) existe pra refinar requisitos antes do
desenvolvimento. Hoje esse refinamento **não chega em lugar nenhum**:

1. **O prompt do dev agent ignora a conversa.** `buildPrompt` (`lib/runner.ts`)
   injeta como "Context from previous stage" apenas o **último item de
   `card.history`** — e `history` são *runs* (tabela `runs`). A coluna de chat
   produz *messages* (tabela `messages`), nunca runs. Card que sai da Enrichment
   direto pra Development entra no agente com prompt = título + descrição, como
   se a conversa nunca tivesse acontecido.

2. **O thread some da UI.** Em `app/page.tsx` o drawer é um ternário sobre
   `openCol?.chat`: coluna de chat mostra `messages`, qualquer outra mostra
   `history`. Card em Development com 11 mensagens e zero runs cai no ramo do
   `history` e exibe "Nenhuma execução ainda.". Nada foi perdido — as mensagens
   continuam no banco e `getBoard()` já as devolve pra todos os cards —, é
   renderização.

O espelho do (2) também é bug: card que volta pra Enrichment depois de rodar em
Development esconde o histórico de runs.

## Decisão de arquitetura

| Decisão | Escolha | Por quê |
|---|---|---|
| Quanto da conversa vai no prompt | **Transcrição inteira**, com teto de caracteres cortando pelo começo | As respostas do usuário **são** os requisitos; o resumo final do agente pode nem existir (dá pra mover o card no meio da conversa), então cortar pelas últimas N mensagens perderia decisões. O chat da Enrichment é curto por design ("3-6 perguntas"), e o teto protege o caso patológico. |
| Onde formatar a transcrição | Módulo novo `lib/transcript.ts` | `buildChatPrompt` já monta transcrição inline; com um segundo consumidor isso vira duplicação (regra `shared-utilities`). O teto de caracteres, que hoje não existe em lugar nenhum, passa a valer pros dois. |
| Quais colunas recebem a transcrição | Todas as não-chat (via `buildPrompt`) | AI Review revisa contra os requisitos acordados; restringir a `development` seria um `if` por id de coluna, coisa que o resto do motor evita. |
| Layout do drawer | **Duas seções independentes**, cada uma condicionada aos próprios dados | Acaba com o ternário: o card mostra o que tem. Chat aparece se houver mensagens (ou se a coluna for de chat, pra manter o hint inicial); histórico aparece se houver runs (ou se a coluna não for de chat). |
| Caixa de mensagem fora de coluna de chat | **Não** | `runChatTurn` usa `persona`/`instruction` da coluna **atual** do card; mandar mensagem em Development montaria um prompt de chat com a persona de dev. Fora de coluna de chat o thread é só leitura. |
| Fetch/store | **Sem mudança** | `getBoard()` (`lib/store.ts`) já monta `messages` pra todo card, e o SSE empurra o board inteiro. O dado sempre esteve no cliente. |

## Modelo de domínio

Nenhuma tabela, coluna ou tipo novo. `Card.messages` e `Card.history` já existem
e já são populados pra qualquer coluna. A única mudança de assinatura é
`buildPrompt`, que passa a receber também `messages`.

## Fluxo técnico

1. Card na Enrichment: usuário conversa, `messages` cresce (inalterado).
2. Usuário arrasta pra Development → `moveCard` → `startAgent` → `runCard`.
3. `runCard` monta `cardForPrompt` com `history` **e** `messages` do board.
4. `buildPrompt` insere, entre o card e o contexto do estágio anterior:

   ```
   ## Requirements discussion (Enrichment)
   The user and the analyst agreed on the scope below. Treat these decisions as requirements.

   Agent: …
   User: …
   ```

   A transcrição passa por `formatTranscript`, que corta pelo começo se estourar
   o teto e marca o corte com `[…earlier messages omitted…]`.
5. `buildChatPrompt` passa a usar o mesmo `formatTranscript` (rótulo do agente =
   `You`), ganhando o teto de graça.
6. Na UI, o drawer renderiza `<ChatThread>` quando há mensagens e a lista de runs
   quando há runs — as duas juntas quando o card tem as duas coisas.

## Novos componentes

- `lib/transcript.ts` — `formatTranscript(messages, opcoes)`: junta as mensagens
  com rótulos configuráveis (`rotuloDoUsuario`, `rotuloDoAgente`) e aplica
  `LIMITE_DE_CARACTERES_DA_TRANSCRICAO` (12 000) descartando mensagens do começo;
  se a última mensagem sozinha estoura, corta o miolo dela pelo fim. O teto é
  rígido — o marcador de corte é descontado do orçamento, não somado a ele.
- `app/ChatThread.tsx` — client component com o thread (bolhas + markdown nas
  respostas do agente + indicador "pensando…"), usado pelas duas situações do
  drawer sem duplicar JSX.

Sem rota nova. `POST /api/cards/:id/message` ganha 409 quando o card não está
numa coluna de chat (a UI não oferece a caixa, mas o endpoint é aberto).

## Mapa de arquivos

**Criar**

- `lib/transcript.ts`
- `app/ChatThread.tsx`

**Modificar**

- `lib/runner.ts` — `buildPrompt` recebe `messages` e injeta a seção; `buildChatPrompt` usa o helper
- `lib/engine.ts` — `runCard` passa `messages` no `cardForPrompt`; `sendMessage` recusa coluna não-chat
- `app/api/cards/[id]/message/route.ts` — traduz a recusa em 409
- `app/page.tsx` — drawer com as duas seções
- `app/globals.css` — estilo do bloco recolhível da conversa em coluna não-chat
- `README.md` — seção "Colunas de chat" descreve o novo comportamento

## Questões em aberto

Nenhuma.
