# Rule: One worktree, one branch, one PR per card

## When to apply

Whenever a card enters a column where an agent writes code (Development and any
column it bounces back to). Applies to every card individually — never batch two
cards into the same worktree or branch.

## How to apply

### 1. Create the worktree before touching any code

The main checkout is never edited by a card agent. First action of the run:

```bash
git worktree add worktrees/<card-id> -b <card-id>/<slug-do-titulo> main
```

- `<card-id>` — the card's id (e.g. `card-451298-298`), stable across runs.
- `<slug-do-titulo>` — short kebab-case slug of the card title, not the whole title.
- Base is always `main`.
- `worktrees/` is gitignored, so the main checkout stays clean.

If the worktree already exists (the card bounced back from review), reuse it —
`git worktree list` first, and only create it when absent.

### 2. Work only inside the worktree

Every read, edit, build, and test for the card runs with the worktree as cwd.
Commits follow [git-conventions](git-conventions.md) — conventional commits in
Portuguese, scope = the touched component.

### 3. Open the PR when the card is ready for human review

Before the card leaves the agent's hands:

```bash
git push -u origin <card-id>/<slug-do-titulo>
gh pr create --base main --title "<Descrição curta em português>" --body "..."
```

### 4. Remove the worktree after the merge

```bash
git worktree remove worktrees/<card-id>
git branch -d <card-id>/<slug-do-titulo>
```

Leaving a merged worktree behind means the next card that touches the same files
starts from stale state.

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

A worktree per card isolates parallel agents from each other: two cards can be in
Development at the same time without one's half-finished edits leaking into the
other's diff or review. The branch and PR give the human reviewer a real diff to
approve or reject, instead of changes already sitting on `main` where rejecting
means a revert. Short PR descriptions get read; long ones get skipped, which
makes the review step worthless.
