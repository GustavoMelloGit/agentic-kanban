# Rule: Design system and component layers

## When to apply

Any change to `app/**` or `components/**` that touches layout, color, spacing,
typography, icons, motion, interaction states, or where a component lives.

## How to apply

### Onde o componente mora (Atomic Design)

Cada camada só depende das de baixo. Componente na camada errada é o começo do
acoplamento que o Atomic Design existe pra evitar.

| Camada | Pasta | Regra |
|---|---|---|
| ui | `components/ui/` | primitiva do shadcn, gerada por `npx shadcn add`. Não edite à mão pra ajustar um caso: passe `className` no consumidor |
| atoms | `components/atoms/` | um elemento, zero regra de negócio, zero fetch |
| molecules | `components/molecules/` | poucos átomos com um propósito; recebe tudo por prop |
| organisms | `components/organisms/` | um bloco inteiro da tela; pode ter estado **de UI** (aberto/fechado), nunca estado do board |
| templates | `components/templates/` | só o esqueleto, recebe as regiões por slot |
| pages | `app/page.tsx` | estado, SSE, chamadas de API e handlers |

Estado do board e chamada de API vivem na página. Organismo que faz `fetch`
sozinho é a exceção, não a regra — hoje só `DirPicker`, porque a navegação de
pastas é um fluxo fechado que não interessa a ninguém acima dele.

### Estilo é Tailwind; token é variável CSS

Classe utilitária do Tailwind no componente. Valor cru (`#5e6ad2`, `13px`,
`0.2s`) não entra nem no componente nem no CSS: vira token em `:root`
(`app/globals.css`) e é exposto ao Tailwind pelo bloco `@theme inline`.

Composição de classe usa `cn()` de `@/lib/ui/utils` — é o que deixa o
`className` do consumidor vencer o padrão do componente.

CSS solto só onde não há elemento pra receber classe: o bloco `.markdown` em
`@layer components`, porque aquele HTML é gerado pelo `react-markdown` em
runtime.

### O contrato de cor do shadcn

`--primary` é a marca (índigo). O `--accent` do shadcn é **superfície de hover**,
não a marca — trocar os dois deixa o board inteiro índigo.

Verde é `APPROVE`, âmbar é `running`/devolução, vermelho é erro/destrutivo.
Nenhum dos três pode virar cor de marca, senão o badge de status perde o
significado.

`--primary` sólido não alcança 4.5:1 como texto sobre os fundos escuros: texto e
link usam `--brand-text` (`text-brand-text`); `--primary` fica pra preenchimento
e borda.

### Ícone é SVG do lucide, nunca emoji

Todo ícone passa por `components/atoms/Icon.tsx` — nome em português, traço 2px,
`currentColor`, três tamanhos (`sm`/`md`/`lg`), sempre `aria-hidden`. Emoji
depende da fonte do sistema, muda de desenho entre plataformas e ignora os
tokens. Emoji em **conteúdo** gerado pelo agente (o `⚠`/`✅` que o motor escreve
no histórico) é texto, não ícone, e pode ficar.

Controle só com ícone precisa de `aria-label` no próprio controle.

### Mínimos que não se negociam

- Contraste de texto **≥ 4.5:1** contra o fundo composto. Fundo de badge é
  translúcido (`bg-running/15`): componha o alfa antes de medir.
- Alvo de clique **≥ 24×24px** (WCAG 2.2). Ícone menor ganha `size-*` no botão,
  não um ícone maior.
- Foco visível em tudo: o `:focus-visible` global já dá o anel — não anule com
  `outline-none`.
- Animação só como feedback, 120–200ms, com `ease-(--ease-board)`. O bloco
  `prefers-reduced-motion` já zera tudo; não crie animação que dependa de rodar.
- Cor nunca sozinha: todo badge de estado carrega ícone ou texto junto.

### Fora de escopo

O board é ferramenta de desktop em localhost (drag-and-drop, spawn de CLI). Não
há layout mobile; não gaste esforço em breakpoint abaixo de ~900px sem pedido
explícito.

## Why

As camadas mantêm a página fina e os blocos reaproveitáveis: quando o estado
mora num lugar só, mudar a regra não exige caçar `useState` espalhado por
organismo. Os tokens fazem a identidade ser um sistema e não uma coleção de
telas — valor cru escrito direto no componente é invisível pro resto do código, e
o próximo agente que mexer na UI vai inventar outro tom do mesmo cinza. Os
mínimos de contraste, alvo e foco estão medidos: alterá-los sem medir de novo
quebra acessibilidade sem ninguém perceber.
