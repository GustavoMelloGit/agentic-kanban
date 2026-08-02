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
- **Tailwind v4 + shadcn/ui** no front, organizados em Atomic Design.

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

## Criar card

Cada coluna tem seu **+ Adicionar card**, que abre um compositor no formato do
card ali mesmo (Notion/Jira): `Enter` cria e mantém o campo aberto pro próximo,
`Esc` fecha, e o seletor de projeto só aparece quando há mais de um cadastrado.

O card nasce **na coluna onde você clicou** — criar direto numa coluna
`autonomous`/`automated` dispara o agente na hora, igual a arrastar o card pra
lá. O compositor avisa disso antes de você apertar Enter.

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
- `lib/runner.ts` — monta o prompt e faz `spawn` da CLI no workspace (ou na worktree do card)
- `lib/worktree.ts` — cria/reaproveita/remove a git worktree e a branch de cada card
- `lib/pr.ts` — consulta a PR da branch do card via `gh` e descreve o resultado
- `lib/transcript.ts` — formata a transcrição do chat pro prompt, com teto rígido de
  caracteres (o marcador de corte sai do próprio orçamento)
- `lib/texto.ts` — normaliza texto vindo do corpo da requisição (`textoNaoVazio`)
- `lib/engine.ts` — mover card, disparar/cancelar agente, encadear colunas e
  rotear pelo veredito (`routeAfterRun`)
- `app/api/*` — endpoints REST + `events` (SSE):
  - cards: `POST /api/cards`, `DELETE /api/cards/:id`, `:id/move`, `:id/run`, `:id/message`
  - projetos: `GET|POST /api/projects`, `PATCH|DELETE /api/projects/:id`
  - pastas: `GET /api/fs?path=…` (listar), `POST /api/fs` (criar subpasta)
- `app/page.tsx` — a página: estado, SSE, handlers. Não desenha nada sozinha
- `app/globals.css` — tokens (contrato do shadcn + extensões) e o CSS do markdown
- `lib/ui/utils.ts` — `cn()`, o merge de classe Tailwind usado por tudo em `components/`

## Front em Atomic Design

`app/page.tsx` só guarda estado e chama a API; a árvore visual mora em
`components/`, em camadas que só dependem pra baixo:

| Camada | Onde | O que é | Exemplos |
|---|---|---|---|
| **ui** | `components/ui/` | primitivas do shadcn, geradas pela CLI — não editar à mão sem motivo | `button`, `dialog`, `select`, `collapsible` |
| **atoms** | `components/atoms/` | um elemento, sem regra de negócio | `Icon`, `Spinner`, `StatusBadge`, `VerdictBadge`, `RunTime`, `EmptyState`, `SkipLink`, `Markdown` |
| **molecules** | `components/molecules/` | poucos átomos com um propósito | `CardComposer`, `AddCardTrigger`, `CardMeta`, `CardActions`, `ChatMessage`, `ChatComposer`, `ColumnHeader`, `ErrorBanner`, `ProjectRow`, `RunEntry`, `WorkspaceField`, `ConnectionStatus` |
| **organisms** | `components/organisms/` | um bloco inteiro da tela, com estado local se precisar | `BoardHeader`, `BoardColumn`, `KanbanCard`, `CardDrawer`, `ChatThread`, `RunHistory`, `ProjectsDialog`, `DirPicker` |
| **templates** | `components/templates/` | só o esqueleto, recebe tudo por slot | `BoardTemplate` |
| **pages** | `app/page.tsx` | estado, dados e handlers | `BoardPage` |

Identidade visual e mínimos de acessibilidade: `.claude/rules/design-system.md`.
- `lib/fsbrowse.ts` — listagem/criação de diretórios com limite em `$HOME` + raiz do app

## Isolamento por card (worktree + branch + PR)

Colunas com `worktree: true` (Development e AI Review) **não** rodam o agente no
workspace do projeto: o motor cria uma git worktree por card antes do spawn e usa
ela como `cwd`. Dois cards em Development ao mesmo tempo não se enxergam.

- **Onde**: `.claude/worktrees/<card-id>/`, dentro do repositório do workspace.
  Fica no `.gitignore` daqui e no `.git/info/exclude` de qualquer repo apontado.
- **Branch**: `<card-id>/<slug-do-titulo>`, criada a partir da branch padrão do
  repositório (`origin/HEAD`, senão `main`/`master`).
- **Reaproveitada** quando o AI Review devolve o card pra Development — mesma
  worktree, mesma branch, os commits do ciclo anterior continuam lá.
- **Removida** quando o card chega em `Done` (`dropWorktree: true`) ou é excluído.
  A branch só é apagada se estiver mergeada — trabalho não integrado sobrevive.
- Workspace que não é repositório git não tem isolamento possível: o agente roda
  no próprio workspace e o motor loga o aviso. Se o repo existe mas a worktree
  falha, o run falha — nunca cai de volta no checkout principal.

O agente não mexe em worktree nem em branch: ele commita, dá push e abre a PR
pra branch base com `gh pr create` (instrução da coluna Development, em
`lib/config.ts`). O corpo da PR é curto por regra — no máximo cinco linhas, só as
decisões que levaram à solução. Detalhes em
`.claude/rules/card-worktree-workflow.md`.

Abrir a PR é instrução de prompt, e prompt não é garantia. Por isso a coluna com
`requiresPr: true` (Human Review) dispara uma checagem ao receber o card: o motor
roda `gh pr list --head <branch>` e escreve o desfecho no histórico — link da PR
quando existe, aviso quando não existe ou quando o `gh` não respondeu. A consulta
não segura a movimentação; a entrada aparece no drawer pelo SSE. Card que nunca
passou por uma coluna de código não tem branch, então não é cobrado.

## Colunas de chat

Uma coluna com `chat: true` (ex.: Enrichment) segura uma conversa em vez de um
run one-shot. Ao chegar o card, o agente abre a conversa; suas respostas
(`POST /api/cards/:id/message`) disparam novos turnos. A transcrição inteira é
reenviada a cada turno, então funciona com qualquer CLI (sem `--resume` nativo).
As mensagens ficam na tabela `messages` e a UI mostra o thread no drawer.

A conversa segue com o card: ao entrar numa coluna de execução, a transcrição vai
no prompt como `## Requirements discussion (Enrichment)` — é assim que o
refinamento chega no dev agent e no review. O drawer mostra a conversa em
qualquer coluna (só leitura fora da coluna de chat) ao lado do histórico de runs.
Transcrição muito longa é cortada pelo começo, porque o fim é onde mora o resumo
dos requisitos.

## Próximos passos

- **UI de gestão de projetos/empresas**: hoje projetos são seed no código.
- **Sessão nativa de chat** (`claude --resume`): otimização sobre o replay de transcrição.
- **Regras** (WIP limit, dependências entre cards, aprovação humana).
