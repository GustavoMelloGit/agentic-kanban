# task-05 — Documenta o novo comportamento

- **Onda:** 4
- **Depende de:** task-02, task-03, task-04
- **Desbloqueia:** nada
- **Tipo de commit:** `docs`
- **Arquivos:** `README.md`

## Contexto

A seção "Colunas de chat" (`README.md:112-118`) termina com "As mensagens ficam
na tabela `messages` e a UI mostra o thread no drawer" — o que agora é só metade
da história. A seção "Estrutura" (linhas 92-110) também não lista
`lib/transcript.ts`.

## Mudanças

1. **Seção "Colunas de chat"** — acrescentar, ao final, que:
   - a transcrição segue com o card: ao entrar numa coluna de execução, ela vai no
     prompt como `## Requirements discussion (Enrichment)` (é assim que o
     refinamento chega no dev agent e no review);
   - o drawer mostra a conversa em qualquer coluna, só leitura fora da coluna de
     chat, ao lado do histórico de runs;
   - transcrição muito longa é cortada pelo começo (o fim é onde mora o resumo
     dos requisitos).
2. **Seção "Estrutura"** — uma linha pra `lib/transcript.ts` logo antes ou depois
   de `lib/runner.ts`, no mesmo estilo das outras (uma frase).

Não mexa em `NEXT_STEPS.md`: nada do que está lá foi resolvido por este trabalho
(o item "Sessão nativa de chat" continua de pé, e o teto de caracteres é
justamente mais um motivo pra ele).

Duas ou três frases no total. O README é enxuto — mantenha assim.

## Como validar

Leitura. Confira que os caminhos citados existem e que a descrição bate com o
código final das tasks 02-04.

## Commit

```
docs(readme): descreve a transcrição da Enrichment no prompt e no drawer
```
