import { createCard } from "../../../lib/engine";
import { logErro } from "../../../lib/log";
import { textoNaoVazio } from "../../../lib/texto";

export async function POST(req: Request) {
  const body = await req.json();

  const titulo = textoNaoVazio(body.title);
  if (!titulo) {
    logErro("criação de card", `título inválido: esperava texto não vazio, veio ${typeof body.title}`);
    return Response.json({ error: "title required" }, { status: 400 });
  }

  try {
    return Response.json(
      createCard({ ...body, title: titulo, columnId: textoNaoVazio(body.columnId) ?? undefined })
    );
  } catch (erro) {
    logErro("criação de card", erro);
    return Response.json({ error: (erro as Error).message }, { status: 400 });
  }
}
