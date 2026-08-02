# Plano: contexto da conversa de Enrichment para o dev agent

Design: [`docs/specs/2026-08-02-contexto-chat-para-dev-agent-design.md`](../../specs/2026-08-02-contexto-chat-para-dev-agent-design.md)

## Objetivo

1. O agente das colunas não-chat (Development, AI Review) recebe a transcrição da
   conversa de Enrichment no prompt.
2. O thread de chat continua visível no drawer depois que o card sai da coluna de
   chat — e o histórico de runs continua visível quando o card volta pra ela.

## Ondas

| Onda | Tarefas | Pode rodar em paralelo? |
|---|---|---|
| 1 | `task-01-helper-transcricao`, `task-02-drawer-duas-secoes` | Sim — arquivos disjuntos (`lib/` vs `app/`) |
| 2 | `task-03-prompt-com-transcricao` | Depende de 01 |
| 3 | `task-04-mensagem-so-em-coluna-de-chat` | Depende de 03 (mesmo arquivo) |
| 4 | `task-05-atualiza-readme` | Depende de 02, 03 e 04 (descreve o estado final) |

## Dependências

| Tarefa | Depende de | Desbloqueia | Arquivos |
|---|---|---|---|
| 01 | — | 03 | `lib/transcript.ts` (novo) |
| 02 | — | 05 | `app/ChatThread.tsx` (novo), `app/page.tsx`, `app/globals.css` |
| 03 | 01 | 04 | `lib/runner.ts`, `lib/engine.ts` |
| 04 | 03 | 05 | `lib/engine.ts`, `app/api/cards/[id]/message/route.ts` |
| 05 | 02, 03, 04 | — | `README.md` |

As tarefas da mesma onda não compartilham arquivo — não há conflito entre agentes
paralelos. As tasks 03 e 04 dividem `lib/engine.ts`, por isso são ondas
diferentes. A task-03 junta `runner.ts` e `engine.ts` de propósito: separá-las
deixaria um commit intermediário que não compila (assinatura de `buildPrompt`
mudada sem o chamador).

## Restrições operacionais

- **Não rode `npm run build`** — o `next dev` do usuário está vivo na porta 3000 e
  os dois escrevem em `.next/`. Valide com `npx tsc --noEmit`.
- **Não toque em `data/board.db*`** — dados reais. Pra inspecionar, copie pro
  `$TMPDIR` e leia a cópia.
- Há mudanças não commitadas em `lib/config.ts`, `lib/runner.ts`, `app/page.tsx`,
  `app/globals.css` e `package.json` (react-markdown + diretiva de exploração de
  workspace). **O estado em disco é a base**, não o último commit — não reverta
  nada disso.
- Branch atual `main`, sem ticket Jira. Escopo do commit por área
  (`feat(runner)`, `fix(board)`, `docs(readme)`). Não faça push.

## Estado final esperado

Card que conversou na Enrichment e foi pra Development:

- prompt do dev agent contém `## Requirements discussion (Enrichment)` com a
  conversa inteira (ou a cauda dela, se muito longa);
- drawer mostra a conversa (recolhível, só leitura) **e** o histórico de runs.
