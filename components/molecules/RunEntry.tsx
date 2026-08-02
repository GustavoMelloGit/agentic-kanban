"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import Icon from "@/components/atoms/Icon";
import Markdown from "@/components/atoms/Markdown";
import RunTime from "@/components/atoms/RunTime";
import VerdictBadge from "@/components/atoms/VerdictBadge";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { RunEntry as Execucao } from "@/lib/config";
import type { Verdict } from "@/lib/verdict";
import { cn } from "@/lib/ui/utils";

// O ponto do trilho resume o desfecho num relance; quem carrega o significado é
// o badge ao lado, porque cor sozinha não informa.
function corDoMarcador(verdict: Verdict | null, falhou: boolean): string {
  if (falhou) return "bg-danger";
  if (verdict === "APPROVE") return "bg-ok";
  if (verdict === "CHANGES_REQUESTED") return "bg-running";
  return "bg-border-strong";
}

export default function RunEntry({
  execucao,
  nomeDaColuna,
  verdict,
  mostrarFerramenta,
  primeira,
  ultima,
  aberta,
}: {
  execucao: Execucao;
  nomeDaColuna: string;
  verdict: Verdict | null;
  mostrarFerramenta: boolean;
  primeira: boolean;
  ultima: boolean;
  aberta: boolean;
}) {
  const [open, setOpen] = useState(aberta);
  const falhou = execucao.ok === false;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="relative pl-6">
      {/* o trilho nasce e morre no centro do marcador (18px), senão sobra um
          traço solto acima da primeira entrada e abaixo da última */}
      {!(primeira && ultima) && (
        <span
          aria-hidden
          className={cn(
            // 4.5px e não 5: o marcador tem 10px em left-0, então seu centro é
            // 5 — o trilho de 1px precisa começar meio pixel antes pra bater
            "bg-border-strong absolute left-[4.5px] w-px",
            primeira ? "top-[18px] bottom-0" : ultima ? "top-0 h-[18px]" : "top-0 bottom-0"
          )}
        />
      )}
      <span
        aria-hidden
        className={cn(
          "ring-surface absolute top-[13px] left-0 size-2.5 rounded-full ring-4",
          corDoMarcador(verdict, falhou)
        )}
      />

      {/* altura fixa: sem ela a linha com badge fica 3px mais alta que a sem, e
          o trilho vira uma escada */}
      <CollapsibleTrigger className="group hover:bg-surface-2 flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left transition-colors">
        <ChevronRight
          aria-hidden
          strokeWidth={2}
          className="text-faint size-3.5 shrink-0 transition-transform duration-150 ease-(--ease-board) group-data-[state=open]:rotate-90"
        />
        <span className="truncate text-[13px] font-medium">{nomeDaColuna}</span>

        {verdict && <VerdictBadge verdict={verdict} />}
        {falhou && (
          <Badge variant="outline" className="bg-danger/15 text-danger border-transparent">
            <Icon name="alerta" size="sm" />
            falhou
          </Badge>
        )}

        <span className="ml-auto flex shrink-0 items-center gap-2">
          {/* a ferramenta só aparece quando muda: repetir "claude" em toda linha
              é ruído que empurra o horário pra fora da vista */}
          {mostrarFerramenta && execucao.tool && (
            <span className="text-faint font-mono text-[11px]">{execucao.tool}</span>
          )}
          <RunTime at={execucao.at} />
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="bg-background mt-1 mb-2 max-h-100 overflow-auto rounded-md border p-3 text-xs leading-relaxed">
          <Markdown content={execucao.output} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
