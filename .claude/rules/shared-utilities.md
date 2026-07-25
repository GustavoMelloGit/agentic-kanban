# Rule: Shared utilities over inline implementations

## When to apply

Whenever writing a utility function, custom decorator, transform, validator, or helper — regardless of whether it is currently used in only one place.

## How to apply

Never implement utility logic inline inside a DTO, use case, provider, or any other consumer file. Always create a dedicated file in the appropriate shared location first, then import it.

### Where each type lives

| Type                                                                           | Location                                                    |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Custom class-validator decorators (`registerDecorator`, `ValidatorConstraint`) | `src/infra/validators/` — export from `index.ts`            |
| Custom NestJS/Swagger decorators (`applyDecorators`, method/class decorators)  | `src/infra/decorators/`                                     |
| Pure utility functions (transforms, sanitizers, formatters, calculations)      | `src/infra/helpers/`                                        |
| Domain-layer pure functions (value object helpers, invariant checks)           | `src/domain/` alongside the relevant entity or value object |

### Wrong — inline logic inside a consumer

```ts
// ❌ inside a DTO file
function sanitizarObjeto(valor: unknown): unknown { ... }

function TamanhoMaximoDados(opcoes?: ValidationOptions) {
  return function (objeto: object, propriedade: string) {
    registerDecorator({ ... });
  };
}

export class MeuDto {
  @Transform(({ value }) => sanitizarObjeto(value))
  @TamanhoMaximoDados()
  data: Record<string, unknown>;
}
```

### Correct — dedicated files, imported by the consumer

```ts
// src/infra/helpers/sanitizar-objeto.helper.ts
export function sanitizarObjeto(valor: unknown): unknown { ... }

// src/infra/decorators/tamanho-maximo-dados.decorator.ts
export function TamanhoMaximoDados(opcoes?: ValidationOptions) { ... }

// src/presentation/dtos/meu.dto.ts
import { TamanhoMaximoDados } from 'src/infra/decorators/tamanho-maximo-dados.decorator';
import { sanitizarObjeto } from 'src/infra/helpers/sanitizar-objeto.helper';

export class MeuDto {
  @Transform(({ value }) => sanitizarObjeto(value))
  @TamanhoMaximoDados()
  data: Record<string, unknown>;
}
```

## Why

Utility logic defined inline in a consumer file is invisible to the rest of the codebase and gets duplicated the next time the same problem appears. A dedicated file with a clear name is discoverable, testable in isolation, and reusable without refactoring.
