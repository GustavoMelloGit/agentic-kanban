import type { ChatMessage, RunEntry } from "./config";
import { ehMarcadorDeCancelamentoNoChat, ehMarcadorDeCancelamentoNoHistorico } from "./cancelamento";

// O que o agente recebe como contexto é só trabalho aproveitável: marcador de
// cancelamento e saída de execução que falhou ficam de fora.
//
// O marcador é recado pro humano, não requisito: a transcrição inteira volta no
// prompt a cada turno e desce pro Development como escopo acordado, então o
// agente passaria a tratar os cancelamentos como assunto do card.
//
// A saída que falhou é traceback. Tratá-la como etapa anterior troca o feedback
// do revisor pelo motivo da quebra — justamente o que o disparo seguinte precisa
// ter em mãos pra terminar o trabalho.

export function mensagensParaContexto(mensagens: ChatMessage[]): ChatMessage[] {
  return mensagens.filter(
    (mensagem) => mensagem.ok !== false && !ehMarcadorDeCancelamentoNoChat(mensagem.content)
  );
}

// `ok` só é gravado pelas execuções do motor; entrada antiga vem sem o campo, e
// por isso o marcador continua sendo conferido também pelo texto.
export function ultimaEtapaParaContexto(historico: RunEntry[]): RunEntry | undefined {
  for (let posicao = historico.length - 1; posicao >= 0; posicao--) {
    const entrada = historico[posicao];
    if (entrada.ok === false) continue;
    if (ehMarcadorDeCancelamentoNoHistorico(entrada.output)) continue;
    return entrada;
  }
  return undefined;
}
