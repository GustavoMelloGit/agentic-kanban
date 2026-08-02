import type { ChatMessage } from "./config";

export type MotivoDeCancelamento = "cancelamento" | "movimentacao" | "exclusao";

interface MarcadoresDoMotivo {
  historico: string;
  chat: string;
}

// Os textos de "movimentacao" são os que o motor já gravava antes de existir o
// botão de cancelar: reescrevê-los deixaria as threads antigas fora do filtro.
export const MARCADORES_DE_CANCELAMENTO: Record<MotivoDeCancelamento, MarcadoresDoMotivo> = {
  cancelamento: {
    historico: "⚠ Operação cancelada",
    chat: "⚠ Operação cancelada",
  },
  movimentacao: {
    historico: "⚠ Execução cancelada pelo usuário (card movido durante a atuação do agente).",
    chat: "⚠ (resposta cancelada — card movido durante a conversa)",
  },
  exclusao: {
    historico: "⚠ Execução cancelada pelo usuário (card excluído durante a atuação do agente).",
    chat: "⚠ (resposta cancelada — card excluído durante a conversa)",
  },
};

const TEXTOS_DE_CANCELAMENTO = new Set(
  Object.values(MARCADORES_DE_CANCELAMENTO).flatMap((marcadores) => [
    marcadores.historico,
    marcadores.chat,
  ])
);

// O marcador é recado pro humano, não requisito: a transcrição inteira volta no
// prompt a cada turno e desce pro Development como escopo acordado, então o
// agente passaria a tratar os cancelamentos como assunto do card. A comparação é
// exata — com `includes`, uma resposta legítima que cite a frase sumiria do
// contexto.
export function semMarcadoresDeCancelamento(mensagens: ChatMessage[]): ChatMessage[] {
  return mensagens.filter((mensagem) => !TEXTOS_DE_CANCELAMENTO.has(mensagem.content));
}
