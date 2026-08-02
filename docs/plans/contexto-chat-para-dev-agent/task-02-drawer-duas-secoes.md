# task-02 — Drawer com conversa e histórico como seções independentes

- **Onda:** 1
- **Depende de:** nada (não toca em `lib/`)
- **Desbloqueia:** task-05
- **Tipo de commit:** `fix`

## Contexto

`app/page.tsx:333-412` é um ternário: `openCol?.chat ? <chat/> : <histórico/>`.
Consequências:

- card que conversou na Enrichment e foi pra Development mostra "Nenhuma execução
  ainda." e a conversa some da tela (o usuário achou que perdeu os dados);
- card que volta de Development pra Enrichment esconde o histórico de runs.

Os dados **já estão no cliente**: `getBoard()` (`lib/store.ts:43-49`) monta
`messages` pra todo card e o SSE empurra o board inteiro. Não mexa em store, API
nem fetch — é só render.

## Arquivo a criar: `app/ChatThread.tsx`

Client component (`"use client"`) que recebe:

```ts
{ messages: ChatMessage[]; pensando: boolean }
```

e devolve o `<div className="chat-thread">` com o mesmo markup que hoje está
inline em `app/page.tsx:335-359`: bolha por mensagem (`msg msg-${role}`), rótulo
`Você`/`Agente`, corpo com `<Markdown>` quando `role === "agent"` e texto cru
quando é do usuário, e o bloco `pensando…` no fim quando `pensando` é `true`.

Não inclua o `<form className="chat-input">` — o input é responsabilidade de quem
usa o componente (só a coluna de chat tem).

## Arquivo a modificar: `app/page.tsx`

Substituir o ternário por duas seções independentes dentro do drawer, nesta
ordem:

### 1. Conversa

- `openCol?.chat` → layout de hoje: `<div className="chat">` com
  `<ChatThread messages={openCard.messages} pensando={openCard.status === "running"} />`,
  o hint "A conversa começa quando o card chega aqui." quando não há mensagens e
  o card não está rodando, e o `<form className="chat-input">` **inalterado**
  (mesmos `disabled`, mesmo `sendChat`).
- coluna **não**-chat com `openCard.messages.length > 0` → bloco recolhível
  reaproveitando o estilo existente `.entry`:

  ```tsx
  <details className="entry chat-archive">
    <summary>
      <b>💬 Conversa</b>
      <span className="hint">{openCard.messages.length} mensagens · só leitura</span>
    </summary>
    <ChatThread messages={openCard.messages} pensando={false} />
  </details>
  ```

  Fechado por padrão (sem `open`): em coluna de trabalho o que interessa primeiro
  é o run, a conversa é referência.
- coluna não-chat sem mensagens → não renderiza nada.

`pensando` só pode ser `true` na coluna de chat: fora dela `status === "running"`
é o agente de run, não o do chat.

### 2. Histórico do agente

Renderizar quando `!openCol?.chat || openCard.history.length > 0` — ou seja, o
comportamento atual nas colunas não-chat, mais o histórico agora aparecendo
também quando o card está numa coluna de chat e já rodou antes. O bloco em si
(`<h4>Histórico do agente (N)</h4>`, o hint de vazio e o `map` com `parseVerdict`)
fica **exatamente como está hoje**, só muda a condição que o envolve.

Ordem final no drawer: título/descrição/excluir → conversa → histórico.

## Arquivo a modificar: `app/globals.css`

Adicionar, perto do bloco `/* chat */`:

```css
.chat-archive[open] > summary { border-bottom: 1px solid var(--border); }
.chat-archive .chat-thread { padding: 10px; }
```

O `.entry` já dá borda e o `summary` já é `flex` com `gap` (linhas 109-110). Nada
além disso — o thread arquivado reusa `.msg`/`.msg-body`.

## Como validar

```bash
npx tsc --noEmit
```

**Não rode `npm run build`** (o `next dev` do usuário está na 3000). Confira no
navegador do usuário:

1. `card-451298-298` (hoje em `development`, 11 mensagens, 0 runs) → drawer mostra
   o `<details>` "💬 Conversa" com as 11 mensagens **e** "Histórico do agente (0)"
   com o hint de vazio.
2. Um card na Enrichment continua com thread aberto + caixa de mensagem, e a
   caixa segue desabilitando enquanto `status === "running"`.

## Commit

```
fix(board): mantém a conversa visível no drawer fora da coluna de chat
```
