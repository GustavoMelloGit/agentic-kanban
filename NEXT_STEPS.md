# Próximos passos

Estado atual: motor pronto (colunas por `type`, disparo/encadeamento/cancelamento
de agente), TypeScript + SQLite (Drizzle) + SSE, **chat interativo** na Enrichment
e **roteamento por veredito** na AI Review (volta pro Development em
`CHANGES_REQUESTED`, com guard de 3 ciclos).
Leia o [README](README.md) para a arquitetura. Ordem sugerida abaixo.

---

## 1. UI de gestão de projetos/empresas  ⭐ próximo

Hoje projetos são seed no código ([lib/config.ts](lib/config.ts) → `SEED_PROJECTS`).
Sem UI, não dá pra usar multi-empresa de verdade.

**Onde:** [lib/store.ts](lib/store.ts), nova rota `app/api/projects/route.ts`, [app/page.tsx](app/page.tsx).

**Como:**
- `store.ts`: `createProject`, `updateProject`, `deleteProject` (emitir `emitChange()`).
- API: `GET/POST /api/projects`, `PATCH/DELETE /api/projects/:id`.
- UI: um painel/modal "Projetos" com campos **nome, ferramenta (claude/cursor), workspace**.
  Validar que o `workspace` existe (ou criar).
- O `<select>` de projeto no header já lê `board.projects` — passa a refletir o CRUD.

---

## 2. Isolamento por card (git worktree/branch)

Quando o dev agent edita código, rodar num branch/worktree próprio evita que dois
cards em paralelo se atropelem no mesmo repo.

**Onde:** [lib/runner.ts](lib/runner.ts) (`runTool`/`resolveWorkspace`), [lib/engine.ts](lib/engine.ts).

**Como:**
- Antes de um run que edita código (colunas `develop`), criar
  `git worktree add ../.wt/<cardId> -b card/<cardId>` a partir do workspace do projeto.
- Rodar o agente com `cwd` = worktree.
- Ao aprovar (chegar em Done?), fazer merge/PR; ao descartar, `git worktree remove`.
- **Gotcha:** exige que o workspace seja um repo git; `workspaces/demo` já é.
  Enrichment (chat) e review **não** precisam de worktree (review só lê o diff).

---

## 3. Sessão nativa de chat (`claude --resume`)

Otimização sobre o replay de transcrição atual ([lib/runner.ts](lib/runner.ts) `buildChatPrompt`).

**Como:**
- Guardar `agentSessionId` por card (nova coluna na tabela `cards`).
- Tool ganha um template `resumeArgs` (ex.: `["-p","{{prompt}}","--resume","{{session}}","--output-format","json"]`).
- Parsear `session_id` do JSON de saída e reusar nos turnos seguintes.
- Fallback pro replay quando a tool não suporta resume (mantém a portabilidade).

---

## 4. Regras (o "algumas regras no meio do caminho")

Camada de políticas aplicada no ponto de decisão do `moveCard`.

**Ideias:** WIP limit por coluna; dependências entre cards (só move se dependência em Done);
gate de aprovação humana antes de colunas autônomas; horários permitidos pra rodar agente.

**Onde:** um `lib/rules.ts` consultado no início de `moveCard`/`startAgent`.

---

## Dívidas menores / hygiene

- **Editar card**: criar, mover e excluir já existem; falta `PATCH` (título/descrição/projeto) + UI.
- **Render de markdown** nas mensagens/histórico (hoje texto cru no `<pre>`).
- **Reset do board**: um botão/endpoint pra limpar (hoje é `rm data/board.db*`).
- **`@types/node` está em ^26** no package.json (Node local é 22) — checar se convém alinhar.
- O `data/board.db` de demo tem uma conversa de exemplo no card-1; apague os
  arquivos `data/board.db*` pra recomeçar do seed.

## Rodar

```bash
npm install
npm run dev
```
