import { cancelarOperacao } from "../../../../../lib/engine";

// Interrompe o agente que está atuando no card. Responde só depois que o job
// desenrolou, pra UI destravar o input sabendo que não vem mais resposta.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resultado = await cancelarOperacao(id);

  if (resultado === "card-inexistente") {
    return Response.json({ error: "card não encontrado" }, { status: 404 });
  }

  // "nada-para-cancelar" não é erro: com o board atualizando por SSE, um duplo
  // clique cai aqui e um 409 pintaria banner de erro à toa.
  return Response.json({ ok: true, cancelada: resultado !== "nada-para-cancelar" });
}
