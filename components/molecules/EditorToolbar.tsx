"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useRef, useState, type KeyboardEvent } from "react";
import Icon, { type NomeDoIcone } from "@/components/atoms/Icon";
import { Button } from "@/components/ui/button";
import { aplicarLink } from "@/lib/ui/editor";

// A barra é atalho, nunca o único caminho: tudo aqui tem tecla equivalente
// (Cmd+B, Cmd+I, Cmd+K) ou atalho de digitação ("- ", "# ", "```").
type Formato = {
  chave: string;
  rotulo: string;
  icone: NomeDoIcone;
  ativo: (editor: Editor) => boolean;
  aplicar: (editor: Editor) => void;
  separaGrupo?: boolean;
};

const FORMATOS: Formato[] = [
  {
    chave: "titulo",
    rotulo: "Título",
    icone: "titulo",
    ativo: (editor) => editor.isActive("heading"),
    aplicar: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    chave: "negrito",
    rotulo: "Negrito (Cmd+B)",
    icone: "negrito",
    ativo: (editor) => editor.isActive("bold"),
    aplicar: (editor) => editor.chain().focus().toggleBold().run(),
    separaGrupo: true,
  },
  {
    chave: "italico",
    rotulo: "Itálico (Cmd+I)",
    icone: "italico",
    ativo: (editor) => editor.isActive("italic"),
    aplicar: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    chave: "riscado",
    rotulo: "Riscado",
    icone: "riscado",
    ativo: (editor) => editor.isActive("strike"),
    aplicar: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  {
    chave: "codigo",
    rotulo: "Código",
    icone: "codigo",
    ativo: (editor) => editor.isActive("code"),
    aplicar: (editor) => editor.chain().focus().toggleCode().run(),
  },
  {
    chave: "link",
    rotulo: "Link (Cmd+K)",
    icone: "link",
    ativo: (editor) => editor.isActive("link"),
    aplicar: aplicarLink,
  },
  {
    chave: "lista",
    rotulo: "Lista com marcador",
    icone: "lista",
    ativo: (editor) => editor.isActive("bulletList"),
    aplicar: (editor) => editor.chain().focus().toggleBulletList().run(),
    separaGrupo: true,
  },
  {
    chave: "listaNumerada",
    rotulo: "Lista numerada",
    icone: "listaNumerada",
    ativo: (editor) => editor.isActive("orderedList"),
    aplicar: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    chave: "checklist",
    rotulo: "Checklist",
    icone: "checklist",
    ativo: (editor) => editor.isActive("taskList"),
    aplicar: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    chave: "citacao",
    rotulo: "Citação",
    icone: "citacao",
    ativo: (editor) => editor.isActive("blockquote"),
    aplicar: (editor) => editor.chain().focus().toggleBlockquote().run(),
    separaGrupo: true,
  },
  {
    chave: "blocoDeCodigo",
    rotulo: "Bloco de código",
    icone: "blocoDeCodigo",
    ativo: (editor) => editor.isActive("codeBlock"),
    aplicar: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
];

const PASSO_DA_SETA: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };

function proximoBotao(tecla: string, atual: number): number | null {
  if (tecla === "Home") return 0;
  if (tecla === "End") return FORMATOS.length - 1;

  const passo = PASSO_DA_SETA[tecla];
  if (passo === undefined) return null;
  return (atual + passo + FORMATOS.length) % FORMATOS.length;
}

export default function EditorToolbar({
  editor,
  desabilitado,
}: {
  editor: Editor | null;
  desabilitado: boolean;
}) {
  // Sem selector o componente não reagiria ao cursor entrar num trecho já
  // formatado, e o botão ficaria mentindo sobre o estado do texto.
  const ativos = useEditorState({
    editor,
    selector: ({ editor }) =>
      FORMATOS.map((formato) => (editor ? formato.ativo(editor) : false)),
  });

  // Foco rotativo: a barra inteira é uma parada de Tab só e as setas andam
  // entre os botões. Sem isso são onze paradas entre o texto e o botão de
  // enviar, e o teclado deixa de ser caminho viável.
  const [botaoNoTab, setBotaoNoTab] = useState(0);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  function andarComSeta(evento: KeyboardEvent<HTMLDivElement>) {
    const destino = proximoBotao(evento.key, botaoNoTab);
    if (destino === null) return;

    evento.preventDefault();
    setBotaoNoTab(destino);
    botoes.current[destino]?.focus();
  }

  return (
    <div
      role="toolbar"
      aria-label="Formatação"
      onKeyDown={andarComSeta}
      className="flex flex-wrap items-center gap-0.5"
    >
      {FORMATOS.map((formato, indice) => (
        <div key={formato.chave} className="contents">
          {formato.separaGrupo && (
            <span aria-hidden="true" className="bg-border mx-1 h-4 w-px" />
          )}
          <Button
            ref={(elemento) => {
              botoes.current[indice] = elemento;
            }}
            type="button"
            variant="ghost"
            size="icon-sm"
            title={formato.rotulo}
            aria-label={formato.rotulo}
            aria-pressed={ativos?.[indice] ?? false}
            tabIndex={indice === botaoNoTab ? 0 : -1}
            disabled={desabilitado || !editor}
            onFocus={() => setBotaoNoTab(indice)}
            // sem isso o clique tira o foco do editor antes do comando rodar, e
            // a formatação cai na posição errada do texto
            onMouseDown={(evento) => evento.preventDefault()}
            onClick={() => editor && formato.aplicar(editor)}
            className="text-muted-foreground aria-pressed:bg-surface-3 aria-pressed:text-brand-text hover:text-foreground"
          >
            <Icon name={formato.icone} size="lg" />
          </Button>
        </div>
      ))}
    </div>
  );
}
