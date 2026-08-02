export type Verdict = "APPROVE" | "CHANGES_REQUESTED";

const VEREDITO_MARCADO = /^\W*VERDICT\W+(APPROVE|CHANGES_REQUESTED)\b/im;
const LINHA_SO_COM_VEREDITO = /^\W*(APPROVED?|CHANGES_REQUESTED)\W*$/i;
const LINHA_FINAL_DE_VEREDITO = /^\W*VERDICT\W+(APPROVE|CHANGES_REQUESTED)\W*$/i;

// Null quando o agente não seguiu o formato: quem chama trata como "não roteia,
// deixa pro humano". O fallback exige uma linha que seja *só* o veredito porque
// a própria instrução da coluna cita as duas palavras — um eco dela não vale.
export function parseVerdict(saida: string): Verdict | null {
  const marcado = saida.match(VEREDITO_MARCADO);
  if (marcado) return marcado[1].toUpperCase() as Verdict;

  const primeiraLinha = saida.split("\n").find((linha) => linha.trim()) ?? "";
  const isolado = primeiraLinha.trim().match(LINHA_SO_COM_VEREDITO);
  if (isolado) return /^C/i.test(isolado[1]) ? "CHANGES_REQUESTED" : "APPROVE";
  return null;
}

export interface TurnoDeChat {
  verdict: Verdict | null;
  // a resposta sem a linha do marcador, que é protocolo e não conversa
  texto: string;
}

// Rotear só quando o marcador encerra o turno: casar em qualquer linha, como
// parseVerdict faz, devolveria o card só porque o agente citou o formato ao
// explicar o fluxo pro humano. E só a linha que roteou sai do texto — apagar um
// marcador que ficou no meio da resposta esconderia do humano a única evidência
// de que o agente tentou encerrar o turno e o card não saiu da coluna.
export function separarVeredito(saida: string): TurnoDeChat {
  const linhas = saida.split("\n");
  const ultimaLinhaComTexto = linhas.reduce(
    (encontrada, linha, posicao) => (linha.trim() ? posicao : encontrada),
    -1
  );
  const marcadorQueEncerra =
    ultimaLinhaComTexto < 0
      ? null
      : linhas[ultimaLinhaComTexto].trim().match(LINHA_FINAL_DE_VEREDITO);

  if (!marcadorQueEncerra) return { verdict: null, texto: saida.trim() };

  return {
    verdict: marcadorQueEncerra[1].toUpperCase() as Verdict,
    texto: linhas
      .filter((_, posicao) => posicao !== ultimaLinhaComTexto)
      .join("\n")
      .trim(),
  };
}

// No lugar do marcador o thread mostra o que ele causou — mesma ideia dos
// marcadores de cancelamento: o usuário vê o desfecho, não o protocolo.
export function notaDeDevolucao(nomeDaColuna: string): string {
  return `↩ Pedido de mudança registrado — card devolvido para ${nomeDaColuna}.`;
}
