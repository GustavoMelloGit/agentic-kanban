# task-04 — `POST /message` recusa card fora de coluna de chat

- **Onda:** 3
- **Depende de:** task-03 (também mexe em `lib/engine.ts`)
- **Desbloqueia:** task-05
- **Tipo de commit:** `fix`
- **Arquivos:** `lib/engine.ts`, `app/api/cards/[id]/message/route.ts`

## Contexto

Depois da task-02 o thread da conversa aparece em qualquer coluna, mas a caixa de
mensagem só na coluna de chat. O endpoint, porém, continua aberto:

```ts
export function sendMessage(id: string, text: string) {
  const t = text.trim();
  if (!t) return;
  addMessage(id, "user", t);
  startChatTurn(id);
}
```

Uma mensagem enviada com o card em Development chamaria `runChatTurn`, que lê
`getColumn(cardRow.columnId)` e montaria um prompt de chat com a **persona e a
instruction de Development** ("Implement this card… Make the necessary code
changes directly"). Ou seja: um agente que edita código disparado por uma caixa
de chat. Fechar isso agora é barato.

## Mudança 1 — `lib/engine.ts`

`sendMessage` passa a devolver um resultado em vez de `void`, e recusa quando o
card não existe ou a coluna atual não tem `chat: true`. Sugestão de forma (o tipo
literal deixa o `switch` da rota exaustivo):

```ts
export type ResultadoDeMensagem = "enviada" | "card-inexistente" | "coluna-sem-chat";

export function sendMessage(id: string, text: string): ResultadoDeMensagem {
  // valida card, valida coluna, loga a recusa via logErro, e só então
  // addMessage + startChatTurn
}
```

Texto vazio continua sendo tratado antes (a rota já barra com 400). Toda recusa
tem que ir pro log — regra `code-quality`: erro sem log é falha silenciosa.

## Mudança 2 — `app/api/cards/[id]/message/route.ts`

Estado atual: chama `sendMessage` e responde `{ ok: true }` sempre. Passa a
traduzir o resultado:

| Resultado | HTTP | Corpo |
|---|---|---|
| `enviada` | 200 | `{ ok: true }` |
| `card-inexistente` | 404 | `{ error: "card não encontrado" }` |
| `coluna-sem-chat` | 409 | `{ error: "o card não está numa coluna de chat" }` |

O `pedirJson` do front (`lib/http.ts`) já lê `error` do corpo e o board já mostra
a faixa de erro no topo — nada a fazer na UI.

## Como validar

```bash
npx tsc --noEmit
```

Com o `next dev` do usuário rodando (não suba outro servidor):

```bash
curl -s -o /dev/stderr -w '%{http_code}\n' -X POST localhost:3000/api/cards/card-451298-298/message \
  -H 'content-type: application/json' -d '{"text":"teste"}'
```

`card-451298-298` está em `development` → esperado `409` e **nenhuma** mensagem
nova no card. Confira no board que a contagem do thread não mudou. Um card na
Enrichment deve continuar respondendo `200`.

## Commit

```
fix(chat): recusa mensagem em card fora de coluna de chat
```
