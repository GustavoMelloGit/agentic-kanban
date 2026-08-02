# Rule: Design system of the board UI

## When to apply

Any change to `app/**` that touches layout, color, spacing, typography, icons,
motion, or interaction states.

## How to apply

### Never write a raw value

Every color, space, radius, font size, shadow, and duration is a token in
`:root` (`app/globals.css`). Use the token; do not invent a hex, a `12px`, or a
`0.2s` inline. If a value you need doesn't exist as a token, the token set is
what needs extending — not the component.

| Grupo | Tokens |
|---|---|
| Superfície | `--bg` → `--surface` → `--surface-2` → `--surface-3` (cada nível é um degrau de elevação) |
| Texto | `--text`, `--text-muted`, `--text-faint` |
| Traço | `--border`, `--border-strong` |
| Acento | `--accent` (preenchimento), `--accent-text` (texto/link), `--accent-soft`, `--accent-hover` |
| Estado | `--running`, `--ok`, `--error` (+ variantes `-soft` e `--error-solid`) |
| Espaço | `--s-1` … `--s-6` (ritmo 4/8) |
| Raio | `--r-sm`, `--r-md`, `--r-lg`, `--r-full` |
| Tipografia | `--fs-xs` … `--fs-xl` |
| Ícone | `--icon-sm`, `--icon-md`, `--icon-lg` |
| Elevação | `--elev-1`, `--elev-2`, `--elev-3` |
| Movimento | `--ease`, `--dur-1`, `--dur-2` |

### Acento é índigo; verde/âmbar/vermelho são estado

`--accent` é o índigo da marca. Verde é `APPROVE`, âmbar é `running`/devolução e
vermelho é erro/destrutivo — nenhum dos três pode virar cor de marca, senão o
badge de status perde o significado.

`--accent` sólido não alcança 4.5:1 como texto sobre os fundos escuros. Texto e
link usam `--accent-text`; `--accent` fica para preenchimento e borda.

### Ícone é SVG, nunca emoji

Ícone estrutural vem de `app/Icon.tsx` — traço 2px, `currentColor`, `viewBox`
24, sempre `aria-hidden`. Emoji depende da fonte do sistema, muda de desenho
entre plataformas e ignora os tokens. Emoji em **conteúdo** gerado pelo agente
(o `⚠`/`✅` que o motor escreve no histórico) é texto, não ícone, e pode ficar.

Controle só com ícone precisa de `aria-label` no próprio botão.

### Mínimos que não se negociam

- Contraste de texto **≥ 4.5:1** contra o fundo composto (o `-soft` dos badges é
  translúcido: componha o alfa antes de medir).
- Alvo de clique **≥ 24×24px** (WCAG 2.2). Ícone menor que isso ganha
  `min-width`/`min-height`, não um ícone maior.
- Foco visível em tudo: o `:focus-visible` global já dá o anel — não anule com
  `outline: none`.
- Animação só como feedback, 120–200ms, com `--ease`. O bloco
  `prefers-reduced-motion` já zera tudo; não crie animação que dependa de rodar.
- Cor nunca sozinha: todo badge de estado carrega ícone ou texto junto.

### Fora de escopo

O board é ferramenta de desktop em localhost (drag-and-drop, spawn de CLI). Não
há layout mobile; não gaste esforço em breakpoint abaixo de ~900px sem pedido
explícito.

## Why

A identidade é um sistema de tokens, não uma coleção de telas. Valor cru escrito
direto no componente é invisível para o resto do código e o próximo agente que
mexer na UI vai inventar outro tom do mesmo cinza. Os mínimos de contraste, alvo
e foco estão medidos: alterá-los sem medir de novo quebra acessibilidade sem
ninguém perceber.
