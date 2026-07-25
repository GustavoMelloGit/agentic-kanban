# Rule: Git conventions

All branches and commits must follow the project's git conventions.

## When to apply

Whenever creating branches, writing commit messages, or opening pull requests.

## How to apply

**Branches:** `TICKET/description` (e.g. `SER-1268/remove-coluna-metadados-tomador`).

**Commits:** conventional commits in **Portuguese**, scope = ticket key extracted from the current branch name:

```
fix(SER-1268): corrige erro de tipo na consulta de margem
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`.

**Breaking changes:** add `!` after the scope (before the `:`) when the change has no backward compatibility — i.e., it removes or renames a field from input/output, changes endpoint behavior in a way that breaks existing clients, or removes a previously accepted value:

```
fix(SER-1268)!: remove campo flow da resposta de criação de proposta
feat(SER-1268)!: substitui valor interno do fluxo por alias na resposta
```

A change is **not** a breaking change if existing valid inputs still work (e.g. relaxing validation, adding optional fields, unblocking previously rejected requests).

Commit messages MUST be a single phrase — short. If there is too much to describe, commit earlier.

Base branch for features/fixes: `development`. Hotfixes base on `main`.

**PR titles:** `TICKET Descrição curta` — Jira key from the branch + short Portuguese phrase:

```
SER-1268 Remove coluna metadados do tomador
SER-1042 Corrige erro de tipo na margem
```

**Commit attribution:** each developer configures `~/.claude/settings.json` globally (not committed):

```json
{
  "attribution": {
    "commit": "Initiated-by: <Name>\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>",
    "pr": "Initiated by: <Name>\n🤖 Generated with [Claude Code](https://claude.com/claude-code)"
  }
}
```

## Why

Consistent branch and commit naming enables traceability between code changes and tickets, and ensures proper attribution in the git history.
