import { startRun } from "../../../../../lib/engine";

// Redispara o agente da coluna atual do card.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const resultado = startRun(id);

  if (resultado === "agente-ocupado") {
    return Response.json(
      { error: "o agente já está atuando neste card — aguarde a execução terminar" },
      { status: 409 }
    );
  }

  if (resultado === "sem-conversa-para-continuar") {
    return Response.json(
      { error: "nesta coluna quem começa a conversa é você — envie uma mensagem no card" },
      { status: 409 }
    );
  }

  return Response.json({ ok: true });
}
