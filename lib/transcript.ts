import type { ChatMessage } from "./config";
import { logErro } from "./log";

export const LIMITE_DE_CARACTERES_DA_TRANSCRICAO = 12_000;

const MARCADOR_DE_CORTE = "[…earlier messages omitted…]";
const SEPARADOR_DE_BLOCOS = "\n\n";
const SEPARADOR_DE_ROTULO = ": ";
const PREFIXO_DE_CORTE = `${MARCADOR_DE_CORTE}${SEPARADOR_DE_BLOCOS}`;

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

// Corta o conteúdo pelo começo até caber no orçamento, nunca o rótulo: um rótulo
// picado ("gent: ") mente sobre quem falou. Se nem o rótulo cabe, ele sai fora.
function montarCaudaDoBloco(bloco: BlocoDaTranscricao, orcamento: number): string {
  const orcamentoDoConteudo = orcamento - bloco.rotulo.length - SEPARADOR_DE_ROTULO.length;
  if (orcamentoDoConteudo <= 0) return bloco.conteudo.slice(-orcamento);

  return montarBloco({
    rotulo: bloco.rotulo,
    conteudo: bloco.conteudo.slice(-orcamentoDoConteudo),
  });
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

  if (limiteDeCaracteres <= 0) {
    logErro(
      "formatação da transcrição",
      `limite de caracteres inválido (${limiteDeCaracteres}) — nada cabe na transcrição`
    );
    return "";
  }

  if (mensagens.length === 0) return "";

  const blocos: BlocoDaTranscricao[] = mensagens.map((mensagem) => ({
    rotulo: mensagem.role === "user" ? rotuloDoUsuario : rotuloDoAgente,
    conteudo: mensagem.content,
  }));

  const transcricaoCompleta = blocos.map(montarBloco).join(SEPARADOR_DE_BLOCOS);
  if (transcricaoCompleta.length <= limiteDeCaracteres) return transcricaoCompleta;

  const ultimoBloco = blocos[blocos.length - 1];
  const orcamentoDasMensagens = limiteDeCaracteres - PREFIXO_DE_CORTE.length;

  if (orcamentoDasMensagens <= 0) {
    logErro(
      "formatação da transcrição",
      `limite de ${limiteDeCaracteres} caracteres não comporta o marcador de corte (${PREFIXO_DE_CORTE.length}) — a transcrição sai truncada sem o aviso`
    );
    return montarCaudaDoBloco(ultimoBloco, limiteDeCaracteres);
  }

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
    if (tamanhoComOBloco > orcamentoDasMensagens) break;
    blocosMantidos.unshift(blocoMontado);
    tamanhoAcumulado = tamanhoComOBloco;
  }

  const cauda =
    blocosMantidos.length > 0
      ? blocosMantidos.join(SEPARADOR_DE_BLOCOS)
      : montarCaudaDoBloco(ultimoBloco, orcamentoDasMensagens);

  return cauda ? `${PREFIXO_DE_CORTE}${cauda}` : MARCADOR_DE_CORTE;
}
