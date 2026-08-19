"use client";

import { Extension, type Editor, type Extensions } from "@tiptap/core";
import HardBreak from "@tiptap/extension-hard-break";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import {
  Markdown,
  type MarkdownNodeSpec,
  type MarkdownStorage,
} from "tiptap-markdown";

// A tiptap-markdown tipa a própria storage mas não a registra no editor, então
// `editor.storage.markdown` sairia como erro de tipo em quem for lê-la.
declare module "@tiptap/core" {
  interface Storage {
    markdown: MarkdownStorage;
  }
}

// O documento é markdown de ponta a ponta: é o que o agente já entende, o que o
// board já sabe renderizar e o que fica gravado no card. O editor é só a forma
// de escrevê-lo — nada de formato proprietário no meio do caminho.

// Dentro de lista, citação ou bloco de código o Enter continua a estrutura em
// vez de enviar: sem isso não há como escrever o segundo item da lista. Cmd+Enter
// envia de qualquer lugar.
const ESTRUTURAS_QUE_SEGURAM_O_ENTER = ["codeBlock", "listItem", "taskItem", "blockquote"];

// A quebra sai como \n puro e não como o "\\\n" do prosemirror-markdown: o
// requisito vai inteiro pro agente, e uma barra invertida no fim de cada linha é
// ruído que ele lê como parte do texto. A volta continua sendo quebra porque o
// markdown é lido com `breaks: true`.
const QuebraDeLinha = HardBreak.extend({
  addStorage(): { markdown: MarkdownNodeSpec } {
    return {
      markdown: {
        serialize(state, node, parent, index) {
          for (let posicao = index + 1; posicao < parent.childCount; posicao++) {
            if (parent.child(posicao).type !== node.type) {
              state.write("\n");
              return;
            }
          }
        },
      },
    };
  },
});

// A tight-lists da tiptap-markdown só registra o atributo `tight` em bulletList
// e orderedList, e sem ele a checklist é serializada solta — com linha em branco
// entre os itens. Continua sendo markdown válido, mas é o requisito que o agente
// lê, e ali a lista espaçada vira outra coisa.
const Checklist = TaskList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      tight: {
        default: true,
        parseHTML: (elemento: HTMLElement) =>
          elemento.getAttribute("data-tight") === "true" || !elemento.querySelector("p"),
        renderHTML: (atributos: Record<string, unknown>) =>
          atributos.tight ? { "data-tight": "true" } : {},
      },
    };
  },
});

function AtalhosDoTeclado(obterEnvio: () => (() => void) | undefined) {
  return Extension.create({
    name: "atalhosDoEditor",
    // acima do padrão porque o HardBreak também reivindica o Mod-Enter: sem a
    // precedência, Cmd+Enter inseriria quebra de linha em vez de enviar
    priority: 1000,
    addKeyboardShortcuts() {
      const enviar = () => {
        const envio = obterEnvio();
        if (!envio) return false;
        envio();
        return true;
      };

      return {
        "Mod-Enter": enviar,
        Enter: () => {
          const dentroDeEstrutura = ESTRUTURAS_QUE_SEGURAM_O_ENTER.some((nome) =>
            this.editor.isActive(nome)
          );
          if (dentroDeEstrutura) return false;
          return enviar();
        },
        // o atalho mora aqui e não no editorProps do componente porque só a
        // extensão enxerga a instância já criada — no componente ele leria o
        // editor do primeiro render, que ainda é nulo
        "Mod-k": () => {
          aplicarLink(this.editor);
          return true;
        },
      };
    },
  });
}

export function extensoesDoEditor({
  placeholder,
  obterEnvio,
}: {
  placeholder: () => string;
  obterEnvio: () => (() => void) | undefined;
}): Extensions {
  return [
    StarterKit.configure({
      // markdown não tem sublinhado: manter o mark faria a mensagem sair com
      // <u> no meio do texto que o agente lê
      underline: false,
      hardBreak: false,
      heading: { levels: [1, 2, 3] },
      // autolink transformaria toda URL digitada em [url](url) no texto salvo;
      // link explícito é decisão de quem escreve, não do editor
      link: { openOnClick: false, autolink: false, linkOnPaste: true },
    }),
    QuebraDeLinha,
    Checklist,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder }),
    Markdown.configure({
      // sem html: o que sai daqui é markdown puro, sem tag invisível no meio do
      // requisito que o agente recebe
      html: false,
      tightLists: true,
      bulletListMarker: "-",
      linkify: false,
      // Enter de texto antigo (descrição escrita na caixa simples) é quebra de
      // verdade, e continua sendo depois de passar pelo editor
      breaks: true,
      // colar texto puro continua puro — quem cola markdown quer o markdown
      transformPastedText: false,
      // copiar de dentro do editor devolve markdown, não texto achatado
      transformCopiedText: true,
    }),
    AtalhosDoTeclado(obterEnvio),
  ];
}

export function markdownDoEditor(editor: Editor): string {
  return editor.storage.markdown.getMarkdown();
}

// Prompt do navegador em vez de um popover próprio: o endereço é uma linha só, e
// um campo flutuante dentro do drawer disputaria o foco com o editor.
export function aplicarLink(editor: Editor) {
  const enderecoAtual: string = editor.getAttributes("link").href ?? "";
  const informado = window.prompt("Endereço do link", enderecoAtual);
  if (informado === null) return;

  const endereco = informado.trim();
  if (!endereco) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }

  const semSelecao = editor.state.selection.empty && !editor.isActive("link");
  if (semSelecao) {
    editor
      .chain()
      .focus()
      .insertContent({
        type: "text",
        text: endereco,
        marks: [{ type: "link", attrs: { href: endereco } }],
      })
      .run();
    return;
  }

  editor.chain().focus().extendMarkRange("link").setLink({ href: endereco }).run();
}
