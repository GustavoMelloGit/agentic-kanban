import type { ChatMessage } from "./config";

export const LIMITE_DE_CARACTERES_DA_TRANSCRICAO = 12_000;

const MARCADOR_DE_CORTE = "[…earlier messages omitted…]";
const SEPARADOR_DE_BLOCOS = "\n\n";

export interface OpcoesDeTranscricao {
  rotuloDoUsuario?: string;
  rotuloDoAgente?: string;
  limiteDeCaracteres?: number;
}

export function formatTranscript(
  mensagens: ChatMessage[],
  opcoes: OpcoesDeTranscricao = {}
): string {
  const {
    rotuloDoUsuario = "User",
    rotuloDoAgente = "Agent",
    limiteDeCaracteres = LIMITE_DE_CARACTERES_DA_TRANSCRICAO,
  } = opcoes;

  if (mensagens.length === 0) return "";

  const blocos = mensagens.map(
    (mensagem) =>
      `${mensagem.role === "user" ? rotuloDoUsuario : rotuloDoAgente}: ${mensagem.content}`
  );

  const transcricaoCompleta = blocos.join(SEPARADOR_DE_BLOCOS);
  if (transcricaoCompleta.length <= limiteDeCaracteres) return transcricaoCompleta;

  // O corte descarta as mensagens mais antigas: o fim da conversa é onde mora o
  // resumo dos requisitos.
  const blocosMantidos: string[] = [];
  let tamanhoAcumulado = 0;
  for (let posicao = blocos.length - 1; posicao >= 0; posicao--) {
    const bloco = blocos[posicao];
    const tamanhoComOBloco =
      blocosMantidos.length === 0
        ? bloco.length
        : tamanhoAcumulado + SEPARADOR_DE_BLOCOS.length + bloco.length;
    if (tamanhoComOBloco > limiteDeCaracteres) break;
    blocosMantidos.unshift(bloco);
    tamanhoAcumulado = tamanhoComOBloco;
  }

  const cauda =
    blocosMantidos.length > 0
      ? blocosMantidos.join(SEPARADOR_DE_BLOCOS)
      : blocos[blocos.length - 1].slice(-limiteDeCaracteres);

  return `${MARCADOR_DE_CORTE}${SEPARADOR_DE_BLOCOS}${cauda}`;
}
