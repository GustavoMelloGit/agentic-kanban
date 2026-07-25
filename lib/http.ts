import { logErro } from "./log";

export interface Resultado<T> {
  ok: boolean;
  dados?: T;
  erro?: string;
}

export async function pedirJson<T>(url: string, init?: RequestInit): Promise<Resultado<T>> {
  try {
    const resposta = await fetch(url, init);
    const corpo = await resposta.json().catch((erro) => {
      logErro(`resposta sem JSON válido em ${url}`, erro);
      return {} as Record<string, unknown>;
    });

    if (!resposta.ok) {
      const erro = (corpo as { error?: string }).error ?? `HTTP ${resposta.status}`;
      logErro(`${init?.method ?? "GET"} ${url}`, erro);
      return { ok: false, erro };
    }
    return { ok: true, dados: corpo as T };
  } catch (erro) {
    logErro(`falha de rede em ${url}`, erro);
    return { ok: false, erro: `falha de rede: ${(erro as Error).message}` };
  }
}
