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

`chat: true` altera as duas colunas da tabela, então a Human Review (`manual` +
`chat` + `verdict`) foge das duas células: o agente não roda na chegada mas roda
a cada mensagem sua, e o card sai dali quando o agente fecha o turno com
`VERDICT: CHANGES_REQUESTED` — sempre pra trás, pro `onReject`. Detalhes em
[Colunas de veredito](#colunas-de-veredito-ai-review-human-review) e
[Colunas de chat](#colunas-de-chat).

## Fluxo das colunas (configurável em `lib/config.ts`)

| Coluna        | type        | Ao terminar                            |
|---------------|-------------|----------------------------------------|
| Ideas         | manual      | —                                      |
| Enrichment    | automated   | fica                                   |
| Development   | autonomous  | → AI Review                            |
| AI Review     | autonomous  | → Human Review / ↩ Development (verdict)|
| Human Review  | manual+chat | fica / ↩ Development (verdict)         |
| Done          | manual      | —                                      |

## Criar card

O **+ Adicionar card** fica só na coluna marcada com `entryPoint: true`
(**Ideas**): card novo entra pela porta da frente e segue o fluxo; as outras
colunas se alcançam arrastando. O botão abre um compositor no formato do card
ali mesmo (Notion/Jira): `Enter` cria e mantém o campo aberto pro próximo, `Esc`
fecha, e o projeto é escolhido no próprio compositor.

O card nasce **na coluna do compositor**. O motor aceita criar em qualquer
coluna (`POST /api/cards` com `columnId`) e, se ela roda agente, dispara na hora
— igual a arrastar o card pra lá. Marcar outra coluna como `entryPoint` é o que
expõe isso na UI; o compositor então avisa antes de você apertar Enter.

Solte um card em **Development** → o agente implementa no workspace do projeto →
ao terminar move sozinho para **AI Review** → review roda → **APPROVE** para em
**Human Review**, **CHANGES_REQUESTED** volta pra **Development**.

## Colunas de veredito (AI Review, Human Review)

Uma coluna com `verdict: true` não avança cegamente: o agente precisa marcar a
saída com `VERDICT: APPROVE` ou `VERDICT: CHANGES_REQUESTED`, e o motor roteia.

- `APPROVE` → `onComplete` (Human Review).
- `CHANGES_REQUESTED` → `onReject` (Development), que recebe o review inteiro
  como "Context from previous stage" no prompt.
- Veredito ilegível (agente não seguiu o formato) → `onComplete`, com um aviso no
  histórico. Na dúvida, sobra pro humano.
- **Guard de loop**: `cards.reviewCycles` conta as devoluções. Ao atingir
  `MAX_REVIEW_CYCLES` (3), o card para em Human Review com um aviso no histórico.
  Qualquer movimentação manual do card zera o contador.

Em coluna de chat só `CHANGES_REQUESTED` roteia: `onComplete` é `null`, então
aprovar continua sendo movimento seu, no arrasto para Done. Num run one-shot o
marcador vale na primeira linha; **numa coluna de chat só roteia na última linha
não vazia do turno** (`separarVeredito`), senão o agente devolveria o card só por
citar o formato ao explicar o fluxo. Só a linha que **roteou** sai do texto, e no
lugar dela o thread mostra "↩ card devolvido para Development": um marcador em
qualquer outra posição fica visível, senão você leria um pedido de mudança
completo sem nenhum sinal de que o card não saiu da coluna. O pedido inteiro vai
pro histórico, que é o canal que o dev agent lê. Devolução pedida pelo humano
**não** consome ciclo de review: ela zera o contador.

## Estrutura

- `lib/config.ts` — tipos do domínio + tools, colunas e seed de projetos/cards
- `lib/schema.ts` — tabelas Drizzle (projects, cards, runs, messages, meta)
- `lib/db.ts` — conexão SQLite, criação de schema, migrações e seed inicial
- `lib/projects.ts` — validação do CRUD de projetos (nome, tool, workspace)
- `lib/cards.ts` — validação do corpo do card: `validateNewCard` (POST, exige título e recusa
  `projectId`/`columnId` que não sejam texto) e `validateCardPatch` (PATCH, só título e descrição)
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
  - cards: `POST /api/cards`, `PATCH|DELETE /api/cards/:id`, `:id/move`, `:id/run`, `:id/message`
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
| **ui** | `components/ui/` | primitivas do shadcn, geradas pela CLI — não editar à mão sem motivo | `button`, `dialog`, `select`, `collapsible`, `message`, `message-scroller`, `bubble` |
| **atoms** | `components/atoms/` | um elemento, sem regra de negócio | `Icon`, `Spinner`, `StatusBadge`, `VerdictBadge`, `RunTime`, `EmptyState`, `SkipLink`, `Markdown` |
| **molecules** | `components/molecules/` | poucos átomos com um propósito | `CardComposer`, `AddCardTrigger`, `CardMeta`, `CardActions`, `ChatMessage`, `ChatComposer`, `ColumnHeader`, `ErrorBanner`, `ProjectRow`, `RunEntry`, `WorkspaceField`, `ConnectionStatus` |
| **organisms** | `components/organisms/` | um bloco inteiro da tela, com estado local se precisar | `BoardHeader`, `BoardColumn`, `KanbanCard`, `CardDrawer`, `ChatThread`, `RunHistory`, `ProjectsDialog`, `DirPicker` |
| **templates** | `components/templates/` | só o esqueleto, recebe tudo por slot | `BoardTemplate` |
| **pages** | `app/page.tsx` | estado, dados e handlers | `BoardPage` |

Identidade visual e mínimos de acessibilidade: `.claude/rules/design-system.md`.
- `lib/fsbrowse.ts` — listagem/criação de diretórios com limite em `$HOME` + raiz do app

## Isolamento por card (worktree + branch + PR)

Colunas com `worktree: true` (Development, AI Review e Human Review) **não** rodam
o agente no workspace do projeto: o motor cria uma git worktree por card antes do
spawn e usa ela como `cwd`. Dois cards em Development ao mesmo tempo não se
enxergam. Turno de chat só reaproveita worktree existente — quem cria é um run.

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

Uma coluna com `chat: true` segura uma conversa em vez de um run one-shot. Quem
fala primeiro depende do `type`: em **Enrichment** (`automated`) o agente abre a
conversa ao card chegar; em **Human Review** (`manual`) nada roda na chegada e
quem começa é você. Suas respostas (`POST /api/cards/:id/message`) disparam novos
turnos. A transcrição inteira é reenviada a cada turno, então funciona com
qualquer CLI (sem `--resume` nativo). As mensagens ficam na tabela `messages` e a
UI mostra o thread no drawer.

O que é específico da coluna vive no `chatPrompt` dela (`briefing`, `opening`,
`continuation`); o resto do prompt — card, transcrição, isolamento git — é
montado pelo `buildChatPrompt`. A `instruction` só entra no turno de abertura: o
que precisa valer em todo turno mora no `briefing`/`continuation`. O thread é um
só por card e atravessa as colunas, então o `agentLabel` decide como as falas do
agente são rotuladas — Enrichment usa `You` porque o thread inteiro é dela; Human
Review fica com o `Agent` neutro, já que lá os turnos anteriores foram escritos
por outra coluna. Coluna de chat com `worktree: true` (Human
Review) **reaproveita** a worktree do card como `cwd`, nunca cria: assim o agente
responde lendo a branch em revisão. Card que nunca passou por Development não tem
worktree — o chat roda no workspace e o agente diz que não há branch pra revisar.

A thread usa o `message-scroller` do shadcn: o transcript é a região que rola
(o drawer em si não rola em coluna de chat), gruda no fim enquanto você está no
fim e solta assim que você rola pra cima, com um botão flutuante pra voltar à
mensagem mais recente. Cada mensagem é um `Message` + `Bubble`; só a resposta do
agente passa por markdown.

A conversa segue com o card: ao entrar numa coluna de execução, a transcrição vai
no prompt como `## Conversation with the user` — é assim que o refinamento chega
no dev agent e no review. O drawer mostra a conversa em qualquer coluna (só
leitura fora da coluna de chat) ao lado do histórico de runs. Transcrição muito
longa é cortada pelo começo, porque o fim é onde mora o resumo dos requisitos.

## Próximos passos

- **UI de gestão de projetos/empresas**: hoje projetos são seed no código.
- **Sessão nativa de chat** (`claude --resume`): otimização sobre o replay de transcrição.
- **Regras** (WIP limit, dependências entre cards, aprovação humana).
