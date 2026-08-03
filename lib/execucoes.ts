// Quais cards têm agente vivo NESTE processo. Mora fora do motor porque o board
// também precisa consultar: card marcado como "running" no banco sem agente
// aqui é execução que morreu junto com o processo (restart, queda), não
// trabalho em andamento. Reaproveitado entre hot-reloads em dev, como o bus.
const g = globalThis as unknown as { __execucoes?: Set<string> };

const cardsComAgenteVivo: Set<string> = g.__execucoes ?? (g.__execucoes = new Set<string>());

export function registrarExecucao(id: string) {
  cardsComAgenteVivo.add(id);
}

export function encerrarExecucao(id: string) {
  cardsComAgenteVivo.delete(id);
}

export function temAgenteVivo(id: string): boolean {
  return cardsComAgenteVivo.has(id);
}
