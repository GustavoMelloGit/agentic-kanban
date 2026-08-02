"use client";

import Icon, { type NomeDoIcone } from "@/components/atoms/Icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MAX_REVIEW_CYCLES, type Column } from "@/lib/config";
import { cn } from "@/lib/ui/utils";

// Qual glifo representa cada coluna é decisão visual, então mora aqui e não na
// config do domínio — que não deve conhecer o conjunto de ícones. Coluna nova
// sem entrada cai no genérico em vez de sumir.
const ICONE_DA_COLUNA: Record<string, NomeDoIcone> = {
  ideas: "ideia",
  enrichment: "refino",
  development: "codigo",
  "ai-review": "revisao",
  "human-review": "pessoa",
  done: "concluido",
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
  const detalhes = detalhesDaColuna(col, columns);

  return (
    // grid de duas colunas: o ícone ocupa a primeira e a etiqueta do tipo cai na
    // segunda, alinhada com o nome — é o que faz os seis cabeçalhos baterem,
    // com ou sem ícone
    <h2 className="mx-1 mb-3 grid grid-cols-[auto_1fr] items-center gap-x-1.5 gap-y-0.5">
      <Icon
        name={ICONE_DA_COLUNA[col.id] ?? "coluna"}
        size="lg"
        className="text-muted-foreground"
      />
      <span className="truncate text-[13px] font-semibold tracking-[-0.005em]">{col.name}</span>

      <div className="col-start-2">
        <Tooltip>
          {/* o gatilho é um botão porque o tooltip precisa abrir no foco também —
              no hover só, quem navega por teclado nunca lê o detalhe */}
          <TooltipTrigger
            className={cn(
              "rounded-sm text-[11px] font-normal underline decoration-dotted underline-offset-2",
              col.type === "manual" ? "text-faint" : "text-brand-text"
            )}
          >
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
      </div>
    </h2>
  );
}
