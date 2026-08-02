"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

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

export default function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={componentes}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
