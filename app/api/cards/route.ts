import { createCard } from "../../../lib/engine";
import { logErro } from "../../../lib/log";

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.title) return Response.json({ error: "title required" }, { status: 400 });

  try {
    return Response.json(createCard(body));
  } catch (erro) {
    logErro("criação de card", erro);
    return Response.json({ error: (erro as Error).message }, { status: 400 });
  }
}
