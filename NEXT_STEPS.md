# Próximos passos

Estado atual: motor pronto (colunas por `type`, disparo/encadeamento/cancelamento
de agente), TypeScript + SQLite (Drizzle) + SSE, **chat interativo** na Enrichment,
**roteamento por veredito** na AI Review (volta pro Development em
`CHANGES_REQUESTED`, com guard de 3 ciclos) e **CRUD de projetos** na UI.
Leia o [README](README.md) para a arquitetura. Ordem sugerida abaixo.

---

## 1. Isolamento por card (git worktree/branch) ⭐ próximo

Quando o dev agent edita código, rodar num branch/worktree próprio evita que dois cards em paralelo se atropelem no mesmo repo.

**Onde:** [lib/runner.ts](lib/runner.ts) (`runTool`/`resolveWorkspace`), [lib/engine.ts](lib/engine.ts).

**Como:**

- Antes de um run que edita código (colunas `develop`), criar
  `git worktree add ../.wt/<cardId> -b card/<cardId>` a partir do workspace do projeto.
- Rodar o agente com `cwd` = worktree.
- Ao aprovar (chegar em Done?), fazer merge/PR; ao descartar, `git worktree remove`.
- **Gotcha:** exige que o workspace seja um repo git; `workspaces/demo` já é.
  Enrichment (chat) e review **não** precisam de worktree (review só lê o diff).

---

## 2. Sessão nativa de chat (`claude --resume`)

Otimização sobre o replay de transcrição atual ([lib/runner.ts](lib/runner.ts) `buildChatPrompt`).

**Como:**

- Guardar `agentSessionId` por card (nova coluna na tabela `cards`).
- Tool ganha um template `resumeArgs` (ex.: `["-p","{{prompt}}","--resume","{{session}}","--output-format","json"]`).
- Parsear `session_id` do JSON de saída e reusar nos turnos seguintes.
- Fallback pro replay quando a tool não suporta resume (mantém a portabilidade).

---

## 3. Regras (o "algumas regras no meio do caminho")

Camada de políticas aplicada no ponto de decisão do `moveCard`.

**Ideias:** WIP limit por coluna; dependências entre cards (só move se dependência em Done);
gate de aprovação humana antes de colunas autônomas; horários permitidos pra rodar agente.

**Onde:** um `lib/rules.ts` consultado no início de `moveCard`/`startAgent`.

---

## Dívidas menores / hygiene

- **Trocar o projeto de um card**: o CRUD está fechado (`PATCH /api/cards/:id` edita título e
  descrição, com UI no drawer), mas o `projectId` é imutável **por decisão**, não por falta de
  tempo: a worktree do card mora dentro do repo do workspace do projeto e `limparWorktree` usa o
  projeto que o card tem na hora de remover — trocar deixaria a worktree órfã pra sempre. Só volta
  a valer a pena junto com uma migração de worktree (ou restrito a card que nunca rodou).
- **Render de markdown** nas mensagens/histórico (hoje texto cru no `<pre>`).
- **Reset do board**: um botão/endpoint pra limpar (hoje é `rm data/board.db*`).
- **`@types/node` está em ^26** no package.json (Node local é 22) — checar se convém alinhar.
- **Excluir projeto exige esvaziar antes** (409 se tiver card). Alternativa seria
  reatribuir os cards pra outro projeto no próprio painel.
- **Workspace não é validado como repo git** — só como diretório (o seletor já
  marca quais pastas têm `.git`). Vira requisito no item 1 (worktree).
- **`/api/fs` expõe listagem de diretórios** de `$HOME` e da raiz do app a quem
  alcançar a porta. Aceitável em localhost (o app já dá spawn de agente com
  `--dangerously-skip-permissions`), mas é um motivo pra não expor essa porta.
- O seed (projeto demo + card-1) roda **uma vez por arquivo de banco**, marcado em
  `meta.seeded`; apague `data/board.db*` pra recomeçar do zero.

## Rodar

```bash
npm install
npm run dev
```
