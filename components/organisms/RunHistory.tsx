"use client";

import { useState } from "react";
import Markdown from "@/components/atoms/Markdown";
import VerdictBadge from "@/components/atoms/VerdictBadge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Column, RunEntry } from "@/lib/config";
import { parseVerdict } from "@/lib/verdict";

function Execucao({
  execucao,
  ehColunaDeVeredito,
  aberta,
}: {
  execucao: RunEntry;
  ehColunaDeVeredito: boolean;
  aberta: boolean;
}) {
  const [open, setOpen] = useState(aberta);
  const verdict = ehColunaDeVeredito ? parseVerdict(execucao.output) : null;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="bg-surface-2 my-3 overflow-hidden rounded-md border"
    >
      <CollapsibleTrigger className="hover:bg-surface-3 flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors">
        <b>{execucao.column}</b>
        {verdict && <VerdictBadge verdict={verdict} />}
        <span className="text-muted-foreground ml-auto text-[11px]">
          {execucao.tool ? `${execucao.tool} · ` : ""}
          {execucao.ok ? "ok" : "erro"} · {execucao.at}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="bg-background mx-3 mb-3 max-h-100 overflow-auto rounded-sm p-3 text-xs">
          <Markdown content={execucao.output} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function RunHistory({
  history,
  columns,
}: {
  history: RunEntry[];
  columns: Column[];
}) {
  return (
    <>
      <h4 className="text-muted-foreground mt-6 mb-2 text-[13px]">
        Histórico do agente ({history.length})
      </h4>
      {history.length === 0 && (
        <p className="text-muted-foreground text-xs">Nenhuma execução ainda.</p>
      )}
      {history
        .slice()
        .reverse()
        .map((execucao, indice) => (
          <Execucao
            key={indice}
            execucao={execucao}
            ehColunaDeVeredito={
              columns.find((coluna) => coluna.id === execucao.column)?.verdict ?? false
            }
            aberta={indice === 0}
          />
        ))}
    </>
  );
}
