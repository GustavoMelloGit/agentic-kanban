import { sendMessage } from "../../../../../lib/engine";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const corpo = (await req.json()) as { text?: unknown } | null;

  const resultado = sendMessage(id, corpo?.text);
  switch (resultado) {
    case "card-inexistente":
      return Response.json({ error: "card não encontrado" }, { status: 404 });
    case "coluna-sem-chat":
      return Response.json({ error: "o card não está numa coluna de chat" }, { status: 409 });
    case "mensagem-vazia":
      return Response.json({ error: "text required" }, { status: 400 });
    case "agente-ocupado":
      return Response.json(
        { error: "o agente ainda está respondendo — aguarde o turno terminar" },
        { status: 409 }
      );
    case "enviada":
      return Response.json({ ok: true });
  }
}
