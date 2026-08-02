import type { ChatMessage } from "./config";
import { logErro } from "./log";

export const LIMITE_DE_CARACTERES_DA_TRANSCRICAO = 12_000;

const MARCADOR_DE_CORTE = "[…earlier messages omitted…]";
const SEPARADOR_DE_BLOCOS = "\n\n";
const SEPARADOR_DE_ROTULO = ": ";

interface BlocoDaTranscricao {
  rotulo: string;
  conteudo: string;
}

export interface OpcoesDeTranscricao {
  rotuloDoUsuario?: string;
  rotuloDoAgente?: string;
  limiteDeCaracteres?: number;
}

function montarBloco(bloco: BlocoDaTranscricao): string {
  return `${bloco.rotulo}${SEPARADOR_DE_ROTULO}${bloco.conteudo}`;
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

  if (limiteDeCaracteres <= 0) {
    logErro(
      "formatação da transcrição",
      `limite de caracteres inválido (${limiteDeCaracteres}) — nada cabe na transcrição`
    );
    return "";
  }

  const blocos: BlocoDaTranscricao[] = mensagens.map((mensagem) => ({
    rotulo: mensagem.role === "user" ? rotuloDoUsuario : rotuloDoAgente,
    conteudo: mensagem.content,
  }));

  const transcricaoCompleta = blocos.map(montarBloco).join(SEPARADOR_DE_BLOCOS);
  if (transcricaoCompleta.length <= limiteDeCaracteres) return transcricaoCompleta;

  // O corte descarta as mensagens mais antigas: o fim da conversa é onde mora o
  // resumo dos requisitos.
  const blocosMantidos: string[] = [];
  let tamanhoAcumulado = 0;
  for (let posicao = blocos.length - 1; posicao >= 0; posicao--) {
    const blocoMontado = montarBloco(blocos[posicao]);
    const tamanhoComOBloco =
      blocosMantidos.length === 0
        ? blocoMontado.length
        : tamanhoAcumulado + SEPARADOR_DE_BLOCOS.length + blocoMontado.length;
    if (tamanhoComOBloco > limiteDeCaracteres) break;
    blocosMantidos.unshift(blocoMontado);
    tamanhoAcumulado = tamanhoComOBloco;
  }

  if (blocosMantidos.length > 0) {
    return `${MARCADOR_DE_CORTE}${SEPARADOR_DE_BLOCOS}${blocosMantidos.join(SEPARADOR_DE_BLOCOS)}`;
  }

  // Nem a última mensagem cabe inteira: corta o conteúdo dela, nunca o rótulo.
  const ultimoBloco = blocos[blocos.length - 1];
  const orcamentoDoConteudo =
    limiteDeCaracteres - ultimoBloco.rotulo.length - SEPARADOR_DE_ROTULO.length;
  if (orcamentoDoConteudo <= 0) return MARCADOR_DE_CORTE;

  const cauda = montarBloco({
    rotulo: ultimoBloco.rotulo,
    conteudo: ultimoBloco.conteudo.slice(-orcamentoDoConteudo),
  });
  return `${MARCADOR_DE_CORTE}${SEPARADOR_DE_BLOCOS}${cauda}`;
}
