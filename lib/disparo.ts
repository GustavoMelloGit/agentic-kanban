import { colunaRodaAgente, type ChatMessage, type Column } from "./config";
import { mensagensParaContexto } from "./contexto";

// Coluna de chat cujo turno de abertura é do humano (Human Review) não tem nem
// `instruction` nem `opening`: com a conversa vazia o prompt sairia sem tarefa
// nenhuma e o turno gravaria no thread uma resposta que ninguém pediu.
export function semTurnoParaRodar(coluna: Column, mensagens: ChatMessage[]): boolean {
  if (!coluna.chat) return false;
  if (coluna.instruction || coluna.chatPrompt?.opening) return false;
  return mensagensParaContexto(mensagens).length === 0;
}

// O mesmo predicado que o motor aplica no disparo manual, pra UI não oferecer um
// "rodar de novo" que a rota vai recusar com 409.
export function podeDispararAgente(
  coluna: Column | undefined,
  mensagens: ChatMessage[]
): coluna is Column {
  return colunaRodaAgente(coluna) && !semTurnoParaRodar(coluna, mensagens);
}
