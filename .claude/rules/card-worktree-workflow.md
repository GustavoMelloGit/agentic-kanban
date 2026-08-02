# Rule: One worktree, one branch, one PR per card

## When to apply

Whenever an agent works a card in a column that edits or reviews code
(Development and AI Review). Applies to every card individually — two cards
never share a worktree or a branch.

## How to apply

### The board owns the worktree; the agent owns the commits

`lib/worktree.ts` creates the worktree **before the agent is spawned** and the
run's cwd is already inside it:

- Path: `.claude/worktrees/<card-id>/` — gitignored here, and added to
  `.git/info/exclude` of whatever repository the project's workspace points at.
- Branch: `<card-id>/<slug-do-titulo>`, based on the repository's default branch.
- Reused when the card bounces back from review, removed when the card reaches
  **Done** or is deleted.

So the agent must **not** run `git worktree add/remove`, `git switch`,
`git checkout <branch>`, or create/delete the branch. If a run needs a worktree
that could not be created, the run fails — it never falls back to editing the
main checkout.

### What the agent does

1. Work only inside the cwd. Never edit files outside it.
2. Commit as you go, following [git-conventions](git-conventions.md) —
   conventional commits in Portuguese, scope = the touched component, one short
   phrase each.
3. When the implementation is done, push and open the PR against the base branch:

```bash
git push -u origin <branch>
gh pr create --base <base> --title "<Descrição curta em português>" --body "..."
```

If a PR is already open for the branch, pushing is enough — but update the body
when the decisions changed. If `gh` is missing or unauthenticated, push anyway
and say so in the run output.

## PR description — short and direct

The body says **which decisions got us to this solution**, nothing else. Maximum
five bullets, one line each. A long description will not be read, so a long
description is a bad description.

Do not include: a file-by-file changelog, a test plan, restated card text,
generated footers, or a summary of what the diff already shows.

### Wrong — a changelog nobody reads

```markdown
## Changes
- Created `app/Markdown.tsx`, a new component that wraps `react-markdown`
  with the `remark-gfm` plugin enabled, exposing a `content` prop...
- Modified `app/ChatThread.tsx` line 19 to check `mensagem.role === "agent"`...
- Added 36 lines to `app/globals.css` covering headings, lists, inline code...
- Bumped `package.json` with two new dependencies.

## Testing
I ran `tsc --noEmit` and `next build`, both clean, and verified in headless...
```

### Correct — the decisions, in five lines or fewer

```markdown
- `react-markdown` + `remark-gfm` em vez de parser próprio: tabela e task list
  saem de graça e o HTML bruto já vem escapado, sem vetor de injeção.
- Só a mensagem do agente vira markdown; a do usuário segue texto puro pra
  preservar exatamente o que foi digitado.
- Tabela larga rola num wrapper próprio em vez de esticar o drawer.
```

## Why

A worktree per card isolates parallel agents: two cards can sit in Development at
the same time without one's half-finished edits leaking into the other's diff or
review. The branch and PR give the human reviewer a real diff to approve or
reject, instead of changes already sitting on the default branch where rejecting
means a revert. Creating it in the engine rather than by prompt makes it a
guarantee — an agent that forgets an instruction cannot end up editing the main
checkout. Short PR descriptions get read; long ones get skipped, which makes the
review step worthless.
