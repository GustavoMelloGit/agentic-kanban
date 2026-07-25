# Rule: Code quality conventions

Universal code quality conventions that apply to all code.

## When to apply

Always — for any new or modified code.

## How to apply

### Variable naming

Variable names MUST convey intention or purpose, not describe content. Single-letter variable names MUST NOT be used.

### Error handling

Errors MUST always be logged. An error that passes without a log entry is a silent failure. If the error is non-critical, log it and continue — but never swallow it silently.

### Comments

Treat comments as a code smell. If a block needs a comment to be understood, review the logic first — the code itself may need to be clearer. Comments are acceptable only when the logic cannot speak for itself.

## Why

These conventions produce code that reads linearly, names that communicate intent, and surfaces failures through structured logging. They reduce cognitive load during review and make the codebase navigable without prior context.
