import { colunaRodaAgente, type ChatMessage, type Column } from "./config";
import { mensagensParaContexto } from "./contexto";

// Numa coluna de chat o disparo manual refaz um turno, então só vale quando há
// turno pra refazer.
//
// "Thread não vazia" não serve como prova de que há: o thread é um só pro card
// inteiro e atravessa as colunas, então em Human Review ele já chega cheio com o
// refinamento. O turno responderia uma pergunta do Enrichment como se fosse o
// pedido do humano — e, se aquilo parecer pedido de mudança, a `continuation`
// manda fechar com `VERDICT: CHANGES_REQUESTED`, que devolve o card e zera o
// orçamento de ciclos de review.
//
// O que prova é a última fala aproveitável da conversa: fala do humano é pedido
// pendente, fala do agente é turno já respondido — refazê-lo duplicaria a
// resposta. Com a conversa vazia, só a coluna que tem abertura própria tem o que
// rodar; em Human Review quem fala primeiro é o humano.
export function semTurnoParaRodar(coluna: Column, mensagens: ChatMessage[]): boolean {
  if (!coluna.chat) return false;

  const conversa = mensagensParaContexto(mensagens);
  const ultimaFala = conversa[conversa.length - 1];

  if (!ultimaFala) return !coluna.instruction && !coluna.chatPrompt?.opening;
  return ultimaFala.role !== "user";
}

// O mesmo predicado que o motor aplica no disparo manual, pra UI não oferecer um
// "rodar de novo" que a rota vai recusar com 409.
export function podeDispararAgente(
  coluna: Column | undefined,
  mensagens: ChatMessage[]
): coluna is Column {
  return colunaRodaAgente(coluna) && !semTurnoParaRodar(coluna, mensagens);
}
