// Checagem da PR da branch do card. O agente de Development é quem abre a PR;
// aqui o motor só confere se ela existe quando o card chega em revisão humana,
// porque instrução em prompt não é garantia.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { logErro } from "./log";

const executarComando = promisify(execFile);

export type ConsultaDePr =
  | { situacao: "encontrada"; url: string; estado: string }
  | { situacao: "ausente" }
  | { situacao: "indisponivel"; motivo: string };

interface PrDoGh {
  url: string;
  state: string;
}

export async function consultarPr(opts: {
  repositorio: string;
  branch: string;
}): Promise<ConsultaDePr> {
  try {
    const { stdout } = await executarComando(
      "gh",
      [
        "pr",
        "list",
        "--head",
        opts.branch,
        "--state",
        "all",
        "--limit",
        "1",
        "--json",
        "url,state",
      ],
      { cwd: opts.repositorio }
    );

    const encontradas = JSON.parse(stdout) as PrDoGh[];
    const pr = encontradas[0];
    if (!pr) return { situacao: "ausente" };

    return { situacao: "encontrada", url: pr.url, estado: pr.state.toLowerCase() };
  } catch (erro) {
    logErro(`consulta de PR da branch ${opts.branch}`, erro);
    return { situacao: "indisponivel", motivo: erro instanceof Error ? erro.message : String(erro) };
  }
}

// Vai pro histórico do card, que é onde o humano olha antes de revisar — daí o
// link cru, que o markdown do drawer transforma em link clicável.
export function descreverConsultaDePr(consulta: ConsultaDePr, branch: string): string {
  if (consulta.situacao === "encontrada") {
    return `✅ PR da branch \`${branch}\` (${consulta.estado}): ${consulta.url}`;
  }
  if (consulta.situacao === "ausente") {
    return (
      `⚠ Nenhuma PR encontrada para a branch \`${branch}\`. O agente de Development deveria ter aberto uma — ` +
      `revise pelo diff local da worktree ou devolva o card para um novo run.`
    );
  }
  return `⚠ Não foi possível consultar a PR da branch \`${branch}\` com o \`gh\`: ${consulta.motivo}`;
}
