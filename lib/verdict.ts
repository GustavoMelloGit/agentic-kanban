export type Verdict = "APPROVE" | "CHANGES_REQUESTED";

const VEREDITO_MARCADO = /^\W*VERDICT\W+(APPROVE|CHANGES_REQUESTED)\b/im;
const LINHA_SO_COM_VEREDITO = /^\W*(APPROVED?|CHANGES_REQUESTED)\W*$/i;

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
