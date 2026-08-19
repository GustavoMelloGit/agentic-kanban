"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef } from "react";
import EditorToolbar from "@/components/molecules/EditorToolbar";
import { extensoesDoEditor, markdownDoEditor } from "@/lib/ui/editor";
import { cn } from "@/lib/ui/utils";

const ALTURA_MINIMA = {
  linha: "min-h-9",
  bloco: "min-h-24",
} as const;

// Editor de texto formatado que guarda markdown: o valor que entra e o que sai
// são a mesma string que o card grava e o agente lê.
//
// `onSubmit` é o que separa os dois usos — no chat ele existe e o Enter envia;
// na descrição do card ele não existe e o Enter só quebra linha, porque quem
// salva é o botão.
export default function RichTextEditor({
  value,
  onChange,
  onSubmit,
  onPasteFiles,
  placeholder,
  ariaLabel,
  desabilitado = false,
  focoInicial = false,
  altura = "linha",
  className,
}: {
  value: string;
  onChange: (markdown: string) => void;
  onSubmit?: () => void;
  onPasteFiles?: (arquivos: File[]) => void;
  placeholder: string;
  ariaLabel: string;
  desabilitado?: boolean;
  focoInicial?: boolean;
  // uma linha na conversa, um bloco na descrição do card: a caixa vazia da
  // descrição precisa parecer um lugar pra escrever requisito, não um input
  altura?: keyof typeof ALTURA_MINIMA;
  className?: string;
}) {
  // O editor é criado uma vez só: cada prop que muda a cada render entra por
  // ref, senão recriar a instância jogaria fora o cursor e o histórico de undo.
  const envio = useRef(onSubmit);
  const mudanca = useRef(onChange);
  const arquivosColados = useRef(onPasteFiles);
  const textoDeApoio = useRef(placeholder);
  envio.current = onSubmit;
  mudanca.current = onChange;
  arquivosColados.current = onPasteFiles;
  textoDeApoio.current = placeholder;

  const editor = useEditor(
    {
      // o componente é client-side, mas o Next ainda renderiza o primeiro passe
      // no servidor: montar o editor ali quebraria a hidratação
      immediatelyRender: false,
      autofocus: focoInicial ? "end" : false,
      content: value,
      extensions: extensoesDoEditor({
        placeholder: () => textoDeApoio.current,
        obterEnvio: () => envio.current,
      }),
      editorProps: {
        attributes: {
          "aria-label": ariaLabel,
          // a mesma classe da prévia: o que se escreve tem a aparência do que
          // vai aparecer na conversa
          class: "markdown editor-content",
        },
        // arquivo é assunto do bloco de anexos, não do texto: o editor só avisa
        // quem cuida deles e não deixa o ProseMirror tentar inserir nada
        handlePaste: (_visao, evento) => receberArquivos(evento.clipboardData?.files),
        handleDrop: (_visao, evento) => receberArquivos(evento.dataTransfer?.files),
      },
      onUpdate: ({ editor }) => mudanca.current(markdownDoEditor(editor)),
    },
    []
  );

  function receberArquivos(lista: FileList | null | undefined) {
    const receptor = arquivosColados.current;
    if (!receptor || !lista?.length) return false;
    receptor(Array.from(lista));
    return true;
  }

  // Valor que muda de fora — envio que limpa a caixa, rascunho devolvido depois
  // de uma falha, troca de card. Comparar antes evita reescrever o documento a
  // cada tecla, o que jogaria o cursor pro fim.
  useEffect(() => {
    if (!editor || markdownDoEditor(editor) === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!desabilitado);
  }, [editor, desabilitado]);

  return (
    <div
      className={cn(
        "border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:ring-[3px]",
        desabilitado && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <div className="border-b px-1.5 py-1">
        <EditorToolbar editor={editor} desabilitado={desabilitado} />
      </div>
      {/* o campo cresce com o texto até o limite e depois rola: sem o teto, uma
          mensagem longa empurraria a conversa pra fora da tela */}
      <EditorContent
        editor={editor}
        className={cn("max-h-64 overflow-y-auto px-3 py-2", ALTURA_MINIMA[altura])}
      />
    </div>
  );
}
