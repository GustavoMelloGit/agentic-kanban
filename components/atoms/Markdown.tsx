"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/ui/utils";

// O conteúdo vem do agente: links abrem fora da aba do board pra não perder o
// estado do drawer, e sem referrer porque o destino é imprevisível.
const componentes: Components = {
  // `node` é a árvore do parser e não é atributo de DOM — vaza como
  // node="[object Object]" no HTML se não for descartado aqui
  a: ({ node, children, ...props }) => (
    <a {...props} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  // o scroll horizontal vai no wrapper pra tabela larga rolar dentro da bolha
  // sem que a <table> precise virar display:block e perder o papel de tabela
  table: ({ node, children, ...props }) => (
    <div className="table-scroll">
      <table {...props}>{children}</table>
    </div>
  ),
};

const PLUGINS = [remarkGfm];
const PLUGINS_COM_QUEBRA_SIMPLES = [remarkGfm, remarkBreaks];

// `quebrasSimples` é pro texto escrito por gente numa caixa de texto, onde o
// Enter é quebra de verdade: sem ele, a descrição antiga — puro texto com
// quebras — viraria um parágrafo só ao ser lida como markdown. A saída do
// agente segue a regra do commonmark, em que a quebra é explícita.
export default function Markdown({
  content,
  quebrasSimples = false,
  className,
}: {
  content: string;
  quebrasSimples?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("markdown", className)}>
      <ReactMarkdown
        remarkPlugins={quebrasSimples ? PLUGINS_COM_QUEBRA_SIMPLES : PLUGINS}
        components={componentes}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
