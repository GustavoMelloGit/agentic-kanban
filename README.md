# Agentic Kanban

Kanban agnóstico de ferramenta onde **agentes trabalham os cards**. Cada card
pertence a um **projeto** (que define qual CLI usar e em qual workspace), e cada
**coluna** define um comportamento (gatilho manual/auto + modo do agente + para
onde mover ao terminar).

## Ideia central

O app **não** conversa com um Claude Code aberto. Ele **invoca** uma CLI headless
no diretório do projeto quando um card entra numa coluna automática:

```
[Board] → move card p/ coluna auto → spawn `claude -p "..."` (ou `cursor-agent ...`)
   ↑                                              │
   └──────────── card atualizado + auto-move ←────┘
```

Trocar de ferramenta = trocar um template de comando (`lib/config.ts` → `TOOLS`).

## Stack

- **Next.js** (App Router) full-stack, um repo — o backend precisa ser um processo
  Node vivo (ele faz `spawn` de CLIs locais), então nada de serverless/edge.
- **TypeScript** em todo o código.
- **SQLite via Drizzle ORM** (`data/board.db`) — projetos, cards e execuções.
- **SSE** (`/api/events`) empurra o board pro front a cada mudança (sem polling).

## Rodar

```bash
npm install
npm run dev   # http://localhost:3000 (usa outra porta se a 3000 estiver ocupada)
```

## Projetos

Um projeto = **nome + ferramenta + workspace**. É ele que decide qual CLI roda e
em qual diretório. Dá pra gerenciar pelo botão **Projetos** no header (criar,
renomear, trocar de ferramenta, mudar o workspace, excluir):

- O workspace pode ser digitado ou escolhido no botão **📁**, que navega os
  diretórios de verdade (o browser não expõe caminho de pasta nem com
  `webkitdirectory`, então quem lista o disco é o backend — `GET /api/fs`,
  limitado a `$HOME` e à raiz do app). O seletor também cria subpasta na hora.
- O diretório é criado se não existir (relativo à raiz do app ou absoluto);
  apontar pra um arquivo é recusado.
- Excluir um projeto exige que ele esteja **sem cards** (409) — card sem projeto
  não teria tool nem workspace pra rodar.
- Sem nenhum projeto cadastrado, não dá pra criar card. O seed (projeto demo)
  roda uma vez só por arquivo de banco, então esvaziar o board não o traz de volta.

## Tipos de coluna

Cada coluna tem um `type` que decide **os dois** comportamentos de uma vez:

| type          | dispara agente ao chegar? | move sozinho ao terminar? |
|---------------|:--:|:--:|
| `autonomous`  | ✅ | ✅ (→ `onComplete`) |
| `automated`   | ✅ | ❌ (fica)           |
| `manual`      | ❌ | ❌                  |

## Fluxo das colunas (configurável em `lib/config.ts`)

| Coluna        | type        | Ao terminar                            |
|---------------|-------------|----------------------------------------|
| Ideas         | manual      | —                                      |
| Enrichment    | automated   | fica                                   |
| Development   | autonomous  | → AI Review                            |
| AI Review     | autonomous  | → Human Review / ↩ Development (verdict)|
| Human Review  | manual      | —                                      |
| Done          | manual      | —                                      |

Solte um card em **Development** → o agente implementa no workspace do projeto →
ao terminar move sozinho para **AI Review** → review roda → **APPROVE** para em
**Human Review**, **CHANGES_REQUESTED** volta pra **Development**.

## Colunas de veredito (AI Review)

Uma coluna com `verdict: true` não avança cegamente: o agente precisa abrir a
saída com `VERDICT: APPROVE` ou `VERDICT: CHANGES_REQUESTED`, e o motor roteia.

- `APPROVE` → `onComplete` (Human Review).
- `CHANGES_REQUESTED` → `onReject` (Development), que recebe o review inteiro
  como "Context from previous stage" no prompt.
- Veredito ilegível (agente não seguiu o formato) → `onComplete`, com um aviso no
  histórico. Na dúvida, sobra pro humano.
- **Guard de loop**: `cards.reviewCycles` conta as devoluções. Ao atingir
  `MAX_REVIEW_CYCLES` (3), o card para em Human Review com um aviso no histórico.
  Qualquer movimentação manual do card zera o contador.

## Estrutura

- `lib/config.ts` — tipos do domínio + tools, colunas e seed de projetos/cards
- `lib/schema.ts` — tabelas Drizzle (projects, cards, runs, messages, meta)
- `lib/db.ts` — conexão SQLite, criação de schema, migrações e seed inicial
- `lib/projects.ts` — validação do CRUD de projetos (nome, tool, workspace)
- `lib/store.ts` — queries/mutations tipadas + `getBoard()`; emite mudança no bus
- `lib/bus.ts` — event bus in-process que alimenta o SSE
- `lib/runner.ts` — monta o prompt e faz `spawn` da CLI no workspace
- `lib/engine.ts` — mover card, disparar/cancelar agente, encadear colunas e
  rotear pelo veredito (`routeAfterRun`)
- `app/api/*` — endpoints REST + `events` (SSE):
  - cards: `POST /api/cards`, `DELETE /api/cards/:id`, `:id/move`, `:id/run`, `:id/message`
  - projetos: `GET|POST /api/projects`, `PATCH|DELETE /api/projects/:id`
  - pastas: `GET /api/fs?path=…` (listar), `POST /api/fs` (criar subpasta)
- `app/page.tsx` — board (drag-and-drop, atualiza via `EventSource`)
- `app/ProjectsPanel.tsx` — modal de CRUD de projetos (botão "Projetos" no header)
- `app/DirPicker.tsx` — seletor de pasta do workspace
- `lib/fsbrowse.ts` — listagem/criação de diretórios com limite em `$HOME` + raiz do app

## Colunas de chat

Uma coluna com `chat: true` (ex.: Enrichment) segura uma conversa em vez de um
run one-shot. Ao chegar o card, o agente abre a conversa; suas respostas
(`POST /api/cards/:id/message`) disparam novos turnos. A transcrição inteira é
reenviada a cada turno, então funciona com qualquer CLI (sem `--resume` nativo).
As mensagens ficam na tabela `messages` e a UI mostra o thread no drawer.

## Próximos passos

- **UI de gestão de projetos/empresas**: hoje projetos são seed no código.
- **Isolamento por card**: git worktree/branch por card ao editar código.
- **Sessão nativa de chat** (`claude --resume`): otimização sobre o replay de transcrição.
- **Regras** (WIP limit, dependências entre cards, aprovação humana).
