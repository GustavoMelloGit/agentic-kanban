"use client";

import Icon, { type NomeDoIcone } from "@/components/atoms/Icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MAX_REVIEW_CYCLES, type Column } from "@/lib/config";
import { cn } from "@/lib/ui/utils";

const ICONE_DO_TIPO: Record<Column["type"], NomeDoIcone | null> = {
  autonomous: "raio",
  automated: "robo",
  manual: null,
};

const REGRA_DO_TIPO: Record<Column["type"], string> = {
  autonomous: "Roda o agente quando o card chega e move o card sozinho ao terminar.",
  automated: "Roda o agente quando o card chega, mas o card fica nesta coluna.",
  manual: "Não roda agente. O card só entra e sai daqui por arrasto.",
};

// A etiqueta da coluna mostra só o tipo; tudo que explica o comportamento vai
// pro tooltip, senão o cabeçalho vira um parágrafo e some a hierarquia.
function detalhesDaColuna(col: Column, colunas: Column[]): string[] {
  const nomeDe = (id: string | null | undefined) =>
    colunas.find((coluna) => coluna.id === id)?.name ?? id ?? "—";

  const linhas = [REGRA_DO_TIPO[col.type]];

  if (col.chat) linhas.push("Segura uma conversa em vez de uma execução única.");
  if (col.onComplete) linhas.push(`Ao terminar, vai para ${nomeDe(col.onComplete)}.`);
  if (col.verdict && col.onReject) {
    linhas.push(
      `O agente fecha com um veredito: APPROVE segue o fluxo, CHANGES_REQUESTED devolve para ` +
        `${nomeDe(col.onReject)} — até ${MAX_REVIEW_CYCLES} vezes.`
    );
  }
  if (col.entryPoint) linhas.push("Porta de entrada: é aqui que novos cards nascem.");
  if (col.worktree) linhas.push("O agente roda na worktree e na branch do próprio card.");
  if (col.requiresPr) linhas.push("Ao chegar, confere se existe PR aberta para a branch do card.");
  if (col.dropWorktree) linhas.push("Ao chegar, a worktree do card é removida.");

  return linhas;
}

export default function ColumnHeader({ col, columns }: { col: Column; columns: Column[] }) {
  const icone = ICONE_DO_TIPO[col.type];
  const detalhes = detalhesDaColuna(col, columns);

  return (
    <h2 className="mx-1 mb-3 flex flex-col items-start gap-0.5 text-[13px] font-semibold tracking-[-0.005em]">
      {col.name}
      <Tooltip>
        {/* o gatilho é um botão porque o tooltip precisa abrir no foco também —
            no hover só, quem navega por teclado nunca lê o detalhe */}
        <TooltipTrigger
          className={cn(
            "hover:decoration-solid inline-flex items-center gap-1 rounded-sm text-[11px] font-normal underline decoration-dotted underline-offset-2",
            col.type === "manual" ? "text-faint" : "text-brand-text"
          )}
        >
          {icone && <Icon name={icone} size="sm" />}
          {col.type}
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-64">
          <ul className="flex list-disc flex-col gap-1 pl-3.5">
            {detalhes.map((detalhe) => (
              <li key={detalhe}>{detalhe}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </h2>
  );
}
