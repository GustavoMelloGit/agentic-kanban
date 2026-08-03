import { startRun } from "../../../../../lib/engine";
import { casoNaoTratado } from "../../../../../lib/exaustividade";

// Redispara o agente da coluna atual do card.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const resultado = startRun(id);
  switch (resultado) {
    case "card-inexistente":
      return Response.json({ error: "card não encontrado" }, { status: 404 });
    case "coluna-sem-agente":
      return Response.json({ error: "esta coluna não tem agente pra rodar" }, { status: 409 });
    case "sem-turno-para-rodar":
      return Response.json(
        { error: "não há turno pendente pra refazer — envie uma mensagem no card" },
        { status: 409 }
      );
    case "agente-ocupado":
      return Response.json(
        { error: "o agente já está atuando neste card — aguarde a execução terminar" },
        { status: 409 }
      );
    case "iniciada":
      return Response.json({ ok: true });
    default:
      casoNaoTratado("run manual", resultado);
      return Response.json({ error: "não foi possível iniciar a execução" }, { status: 500 });
  }
}
