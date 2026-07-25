# Rule: Post-modification communication

## When to apply

Immediately after applying any code or file modification.

## How to apply

**Do not write a summary of what was done.** The user reads git history — repeating what changed is noise.

After modifications, only write if there is something that:

- Was **not** completed and still needs action
- Requires the user's **opinion or decision** before proceeding

If everything was completed and nothing is pending, write nothing.

## Why

Summaries of completed work add no value when the diff is already visible in git. Communicating only what is unresolved or undecided keeps responses lean and actionable.
