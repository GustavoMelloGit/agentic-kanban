# task-01 — Helper de transcrição de chat

- **Onda:** 1
- **Depende de:** nada
- **Desbloqueia:** task-03
- **Tipo de commit:** `feat`

## Contexto

`buildChatPrompt` (`lib/runner.ts:57-59`) monta a transcrição inline:

```ts
const transcript = card.messages
  .map((mensagem) => `${mensagem.role === "user" ? "User" : "You"}: ${mensagem.content}`)
  .join("\n\n");
```

A task-03 precisa da mesma formatação com outro rótulo pro agente. Regra
`shared-utilities`: extrair pra módulo próprio **antes** de ter o segundo
consumidor. Aproveitamos pra impor um teto de caracteres, que hoje não existe
(uma conversa longa vai inteira pro `argv` do spawn).

## Arquivo a criar

`lib/transcript.ts`

### Conteúdo esperado

```ts
import type { ChatMessage } from "./config";

export const LIMITE_DE_CARACTERES_DA_TRANSCRICAO = 12_000;

const MARCADOR_DE_CORTE = "[…earlier messages omitted…]";

export interface OpcoesDeTranscricao {
  rotuloDoUsuario?: string;
  rotuloDoAgente?: string;
  limiteDeCaracteres?: number;
}

export function formatTranscript(
  mensagens: ChatMessage[],
  opcoes: OpcoesDeTranscricao = {}
): string {
  // …
}
```

Comportamento exigido:

1. Cada mensagem vira `` `${rotulo}: ${conteudo}` ``; blocos separados por
   `"\n\n"`. Padrões: `rotuloDoUsuario = "User"`, `rotuloDoAgente = "Agent"`,
   `limiteDeCaracteres = LIMITE_DE_CARACTERES_DA_TRANSCRICAO`.
2. Lista vazia → string vazia.
3. Se o texto montado couber no limite, devolve como está.
4. Se estourar, **descarta mensagens do começo** (as mais antigas) até caber e
   prefixa `MARCADOR_DE_CORTE` seguido de linha em branco. Cortar pela cauda é
   proposital: o fim da conversa é onde mora o resumo dos requisitos.
5. Se a **última** mensagem sozinha já estourar o limite, corte-a preservando o
   fim do conteúdo (`.slice(-orcamento)`) e o rótulo inteiro, também com o
   marcador na frente.
6. `limiteDeCaracteres` é **teto rígido**: nenhum retorno pode excedê-lo. O
   marcador de corte e o separador saem do próprio orçamento. Se o teto não
   comporta nem o marcador, a transcrição sai truncada sem ele (com log).

Regras do projeto que valem aqui: nomes de variável que dizem intenção (nada de
`m`, `i`, `acc`), comentário só onde a lógica não fala por si (o *porquê* de
cortar pelo começo merece uma linha; o `map`/`join` não).

## Como validar

```bash
npx tsc --noEmit
```

Checagem manual rápida (Node 22 local; **apague o arquivo depois**, não commite):

```bash
cat > /tmp/checa-transcricao.ts <<'EOF'
import { formatTranscript } from "/Users/gustavo/Documents/Personal/agentic-kanban/lib/transcript.ts";
const mensagens = [
  { role: "agent" as const, content: "oi", at: "" },
  { role: "user" as const, content: "quero X", at: "" },
];
console.log(formatTranscript(mensagens));
console.log("---");
console.log(formatTranscript(mensagens, { rotuloDoAgente: "You", limiteDeCaracteres: 12 }));
EOF
node --experimental-strip-types /tmp/checa-transcricao.ts && rm /tmp/checa-transcricao.ts
```

Pra isso funcionar o import de `ChatMessage` em `lib/transcript.ts` precisa ser
`import type` (é só tipo, o strip-types remove). Se o comando falhar por causa de
resolução de módulo, `npx tsc --noEmit` já é validação suficiente — não instale
dependência nova pra rodar o check.

Esperado: primeira saída `Agent: oi\n\nUser: quero X`; segunda começando com o
marcador de corte e contendo só a última mensagem.

## Commit

```
feat(runner): extrai formatação de transcrição de chat com teto de caracteres
```
