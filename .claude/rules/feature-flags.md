# Rule: Feature flags

## When to apply

Whenever a change must be placed behind a feature flag, or the user asks that existing behavior be preserved when the flag is off.

## How to apply

Choose the mechanism based on **when** the decision must be made:

### Unleash — runtime decisions

Use `FeatureFlagService.isEnabled('nome-da-flag')` for decisions taken **inside a use case, provider, or worker** — i.e., after all NestJS modules have fully initialized.

- Inject via `@Inject(FeatureFlagServiceSymbol)` with type `FeatureFlagService`.
- Symbol and interface are in `src/application/services/feature-flag.service.ts`.
- Allows toggling behavior without a redeploy.

```ts
constructor(
  @Inject(FeatureFlagServiceSymbol)
  private readonly featureFlagService: FeatureFlagService,
) {}

async executar(input: Input): Promise<void> {
  const novoFluxoAtivo = await this.featureFlagService.isEnabled('novo-fluxo-proposta');

  if (novoFluxoAtivo) {
    // novo comportamento
  } else {
    // comportamento anterior intacto
  }
}
```

### Env var — bootstrap decisions

Use an env var for decisions that must be known **during module resolution, connection setup, or infrastructure initialization** — before `UnleashFeatureFlagService.onModuleInit()` runs.

- Declare the property in `src/infra/configs/environment.ts` with `@IsString() @IsOptional()`.
- Naming convention: `MAIUSCULAS_COM_UNDERSCORE` (e.g., `BULL_QUEUE_PREFIX`, `DD_ENABLED`).
- Outside an injectable (e.g., `queueconfig.ts`): read via `process.env.NOME_DA_VAR?.trim()`.
- Inside an injectable: read via `this.configService.get('NOME_DA_VAR')`.
- **Required: propagate to `.github/workflows/deploy.yml`** in BOTH places:
  1. Migration job `--set-env-vars` string.
  2. Cloud Run service YAML `env:` block.
     Use `${{ vars.NOME_DA_VAR }}` for non-sensitive config and `${{ secrets.NOME_DA_VAR }}` for credentials. Without this step, the env var will not be injected in production.
- Only apply the new behavior when the value is present and non-empty:

```ts
// fora de injectable (ex.: queueconfig.ts)
const bullPrefix = process.env.BULL_QUEUE_PREFIX?.trim();

export const queueConnection = {
  connection: { ... },
  ...(bullPrefix ? { prefix: bullPrefix } : {}),
};

// dentro de injectable (ex.: BullQueueService)
const bullPrefix = this.configService.get('BULL_QUEUE_PREFIX')?.trim();

const queue = new Queue(queueName, {
  connection: redisConnection,
  ...(bullPrefix ? { prefix: bullPrefix } : {}),
});
```

### Deciding which to use

| Situação                                                                                      | Mecanismo |
| --------------------------------------------------------------------------------------------- | --------- |
| Decisão tomada dentro de um use case, provider, ou worker (módulo já inicializado)            | Unleash   |
| Decisão tomada durante resolução de módulos, configuração de conexão, criação de filas BullMQ | Env var   |

### Mandatory: default behavior must be preserved

Flag off / env var absent → behavior **identical** to before the change. Never alter the existing default path under a flag.

## Why

Unleash initializes asynchronously after NestJS resolves all modules. Bootstrap decisions — queue connections, prefixes, infrastructure configuration — are already needed at that point, so only env vars work there. For runtime decisions, Unleash is preferred because it allows toggling without a redeploy.
