# Rule: Maestro as mandatory entry point

For any implementation, refactoring, bug fix, or feature addition task, the **maestro** agent must be the first agent invoked.

## When to apply

Whenever the user requests:

- New feature implementation
- Bug fix
- Code refactoring
- Any change involving multiple files or application layers

## How to apply

Before dispatching to specialized agents (architect, coder, code-reviewer, etc.), invoke maestro so it:

1. Interprets the task intent
2. Orchestrates the correct flow between subagents
3. Ensures automatic review before the final handoff

## Why

Maestro centralizes orchestration and prevents specialized agents from being called directly without prior planning, reducing rework and inconsistencies across layers.

## Agent identification

Every response must be prefixed to identify which agent is speaking:

- **Maestro responding directly:** start every response with `[Maestro]`
- **Dispatching a subagent:** announce in the format `[<subagent>] <task>` before invoking the Agent tool. Examples: `[coder] implementar endpoint de consulta de margem`, `[architect] planejar migração de schema`
