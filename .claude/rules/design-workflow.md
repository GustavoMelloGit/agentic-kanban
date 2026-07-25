# Rule: Design-first workflow

## When to apply

Whenever starting any feature, integration, or architectural change that involves multiple layers, new aggregates, new providers, or decisions that affect more than one file.

## How to apply

### 0. Jira ticket (when the user asks for one before development)

When the user asks to create a Jira task/ticket before starting development, create it and, in the same action and without asking for confirmation:

- **Assign it to the authenticated user** — resolve the current account via `atlassianUserInfo` and set that `accountId` as the assignee.
- **Move it straight to "In Progress"** — apply the "In Progress" transition right after creation (do not leave it in Backlog/To Do).

Follow the board conventions when creating (SER board → project `SER`, parent epic `SER-784`).

### 1. Design document first (`docs/specs/`)

Before any code, create a design document at `docs/specs/YYYY-MM-DD-feature-design.md`. Iterate on it with the user until all architectural decisions are resolved and the "Questões em Aberto" section is empty.

The design document must cover:

- Problem statement
- Architectural decision (where to implement and why)
- Domain model changes (new entities, aggregates, value objects, alterations to existing ones)
- Technical flow (step by step, with sequence diagram when helpful)
- New components (domain, infrastructure, use cases, webhook, presentation)
- Metrics
- File map (files to create/modify)
- Open questions — only move to implementation when this section is empty

**Hard gate:** if the design document has any unresolved entry in "Questões em
Aberto", **do not create the implementation plan**. Instead, list the open
questions and ask the user to resolve them. This applies even if the user
explicitly asks to proceed — surface the blockers and wait.

### 2. Implementation plan after (`docs/plans/`)

Only after the design document is approved, create an implementation plan as a
**folder** at `docs/plans/TICKET-feature-name/` containing:

- `00-visao-geral.md` — objective, wave execution order, dependency table between tasks
- One file per task: `task-NN-short-name.md`

Each task file must include:

- Wave number and dependencies
- Commit type (`feat`, `refactor`, `fix`, etc.)
- Which tasks it blocks
- Target file(s) with current state and the exact changes to apply
- Build/test instructions and the commit message to use at the end

Tasks with no mutual dependencies run in the same wave and can be dispatched to
parallel agents.

### 3. Commit every change to `docs/`

Any edit to a file inside `docs/` must be committed immediately in the same response — same rule that applies to code files. Use `docs(<scope>): <description>` as the commit type, with scope extracted from the current branch name.

## Why

Iterating on a design document before writing code prevents architecture drift, surfaces domain model conflicts early (before they are encoded in migrations or entities), and maintains a permanent audit trail of architectural decisions via git history. The design document is the artifact that makes code review of complex features tractable.
