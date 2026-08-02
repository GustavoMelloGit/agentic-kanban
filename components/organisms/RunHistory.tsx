import { diaDaExecucao, rotuloDoDia } from "@/components/atoms/RunTime";
import RunEntry from "@/components/molecules/RunEntry";
import type { Column, RunEntry as Execucao } from "@/lib/config";
import { parseVerdict } from "@/lib/verdict";

// Histórico é linha do tempo: do mais recente pro mais antigo, com separador
// quando vira o dia — sem isso duas execuções às 16:45 de dias diferentes ficam
// indistinguíveis.
export default function RunHistory({
  history,
  columns,
}: {
  history: Execucao[];
  columns: Column[];
}) {
  const nomeDaColuna = (id: string) => columns.find((coluna) => coluna.id === id)?.name ?? id;
  const ehDeVeredito = (id: string) => columns.find((coluna) => coluna.id === id)?.verdict ?? false;

  const doMaisRecente = history.slice().reverse();

  return (
    <section className="mt-6">
      <h4 className="text-muted-foreground mb-3 text-[13px] font-medium">
        Histórico do agente
        {history.length > 0 && (
          <span className="text-faint ml-2 tabular-nums">
            {history.length} {history.length === 1 ? "execução" : "execuções"}
          </span>
        )}
      </h4>

      {history.length === 0 && (
        <p className="text-faint rounded-md border border-dashed px-3 py-4 text-center text-xs">
          Nenhuma execução ainda.
        </p>
      )}

      {doMaisRecente.map((execucao, indice) => {
        const anterior = doMaisRecente[indice - 1];
        const trocouDeDia = !anterior || diaDaExecucao(anterior.at) !== diaDaExecucao(execucao.at);

        return (
          <div key={`${execucao.at}-${indice}`}>
            {trocouDeDia && (
              <p className="text-faint mt-3 mb-1 pl-6 text-[11px] tracking-[0.06em] uppercase first:mt-0">
                {rotuloDoDia(execucao.at)}
              </p>
            )}
            <RunEntry
              execucao={execucao}
              nomeDaColuna={nomeDaColuna(execucao.column)}
              verdict={ehDeVeredito(execucao.column) ? parseVerdict(execucao.output) : null}
              mostrarFerramenta={execucao.tool !== anterior?.tool}
              primeira={indice === 0}
              ultima={indice === doMaisRecente.length - 1}
              aberta={indice === 0}
            />
          </div>
        );
      })}
    </section>
  );
}
