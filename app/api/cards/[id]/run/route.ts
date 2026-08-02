import { startRun } from "../../../../../lib/engine";

// Redispara o agente da coluna atual do card.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (startRun(id) === "agente-ocupado") {
    return Response.json(
      { error: "o agente já está atuando neste card — aguarde a execução terminar" },
      { status: 409 }
    );
  }
  return Response.json({ ok: true });
}
