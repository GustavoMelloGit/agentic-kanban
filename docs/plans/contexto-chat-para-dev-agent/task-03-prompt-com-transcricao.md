# task-03 — `buildPrompt` injeta a conversa de Enrichment

- **Onda:** 2
- **Depende de:** task-01 (`lib/transcript.ts`)
- **Desbloqueia:** task-04
- **Tipo de commit:** `feat`
- **Arquivos:** `lib/runner.ts`, `lib/engine.ts`

`runner.ts` e `engine.ts` vão juntos de propósito: mudar a assinatura de
`buildPrompt` sem atualizar o chamador deixaria um commit que não compila.

## Contexto

`lib/runner.ts:17-32` monta o prompt das colunas não-chat e só conhece
`card.history` (runs). A conversa da Enrichment vive em `card.messages` e nunca
entra no prompt — o dev agent recebe título + descrição e mais nada.

## Mudança 1 — `buildPrompt` (`lib/runner.ts`)

Estado atual:

```ts
export function buildPrompt(
  column: Column,
  card: { title: string; description: string; history: RunEntry[] },
  project: Project
): string {
  const parts: string[] = [];
  if (column.persona) parts.push(`You are ${column.persona}.`);
  parts.push(`Project: ${project.name}`);
  parts.push(`\n## Card: ${card.title}\n${card.description || "(no description)"}`);
  if (card.history.length) {
    const last = card.history[card.history.length - 1];
    parts.push(`\n## Context from previous stage (${last.column})\n${last.output}`);
  }
  parts.push(`\n## Your task\n${column.instruction}`);
  return parts.join("\n");
}
```

Alterações:

1. Assinatura passa a incluir `messages: ChatMessage[]` no objeto `card`
   (`ChatMessage` já é importado no arquivo).
2. **Entre** a seção do card e a de "Context from previous stage", quando
   `card.messages.length > 0`, inserir:

   ```
   ## Requirements discussion (Enrichment)
   The user and the analyst agreed on the scope below. Treat these decisions as requirements — they refine the card description and, where they conflict with it, win.

   <transcrição>
   ```

   A transcrição vem de `formatTranscript(card.messages)` — rótulos padrão
   (`User` / `Agent`), teto padrão.
3. Ordem preservada: card → conversa → contexto do estágio anterior → task. O
   contexto do run anterior (ex.: feedback do AI Review) fica colado na task
   porque é o mais acionável.

## Mudança 2 — `buildChatPrompt` usa o helper (`lib/runner.ts`)

`lib/runner.ts:57-60` monta a transcrição inline com rótulo `You` pro agente.
Trocar por `formatTranscript(card.messages, { rotuloDoAgente: "You" })`,
mantendo o cabeçalho `\n## Conversation so far\n…` e todo o resto do texto do
prompt intacto — inclusive a `WORKSPACE_EXPLORATION_DIRECTIVE` recém-adicionada.
**Não reverta nada do que está sem commit em `lib/runner.ts`.**

Efeito colateral desejado: o chat também passa a respeitar o teto de caracteres.

## Mudança 3 — o chamador (`lib/engine.ts:120-124`)

Estado atual:

```ts
const cardForPrompt: Pick<Card, "title" | "description" | "history"> = {
  title: cardRow.title,
  description: cardRow.description,
  history: board.cards.find((card) => card.id === id)?.history ?? [],
};
```

Passa a incluir `messages`. `board` já é o snapshot completo e
`board.cards.find(...)` já traz `messages` — só não estava sendo lido. Evite
percorrer o array duas vezes: guarde o card do board numa variável nomeada
(ex.: `cardDoBoard`) e leia `history` e `messages` dela. O `Pick<Card, …>` ganha
`"messages"`.

`runChatTurn` (`lib/engine.ts:233-238`) não muda.

## Como validar

```bash
npx tsc --noEmit
```

Deve passar limpo. **Não rode `npm run build`.**

Teste de ponta a ponta (opcional, custa uma execução de agente): arraste um card
com conversa da Enrichment pra Development e confira nos logs do `next dev` /
no run gravado que o agente entendeu os requisitos discutidos.

## Commit

```
feat(runner): injeta a conversa de Enrichment no prompt das colunas de execução
```
