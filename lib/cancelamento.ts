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

const TEXTOS_NO_CHAT = new Set(
  Object.values(MARCADORES_DE_CANCELAMENTO).map((marcadores) => marcadores.chat)
);

const TEXTOS_NO_HISTORICO = new Set(
  Object.values(MARCADORES_DE_CANCELAMENTO).map((marcadores) => marcadores.historico)
);

// A comparação é exata — com `includes`, uma resposta legítima que cite a frase
// seria confundida com o marcador.
export function ehMarcadorDeCancelamentoNoChat(conteudo: string): boolean {
  return TEXTOS_NO_CHAT.has(conteudo);
}

export function ehMarcadorDeCancelamentoNoHistorico(saida: string): boolean {
  return TEXTOS_NO_HISTORICO.has(saida);
}
