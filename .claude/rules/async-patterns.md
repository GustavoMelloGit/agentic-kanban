# Rule: Async patterns — Promise over for loops

## When to apply

Whenever iterating over a collection to execute async operations (repository calls, provider calls, event dispatches, etc.).

## How to apply

**Prefer `Promise.allSettled` or `Promise.all` over `for` loops:**

- Use `Promise.allSettled` when failures must be tolerated individually (processing continues for the rest of the batch):

```ts
const results = await Promise.allSettled(
  items.map((item) => this.#process(item)),
);

for (const [index, result] of results.entries()) {
  if (result.status === 'rejected') {
    this.logger.error('Erro ao processar item', {
      item_id: items[index].id,
      error: result.reason,
    });
  }
}
```

- Use `Promise.all` when all operations must succeed (one failure aborts the whole batch):

```ts
await Promise.all(items.map((item) => this.#process(item)));
```

**Never use a sequential `for` loop for async operations on a collection** unless ordering or sequential dependency is strictly required.

## Why

Parallel execution is faster and `Promise.allSettled` ensures individual failures do not abort the processing of the remaining items, while still surfacing errors through structured logging.
