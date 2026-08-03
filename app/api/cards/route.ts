import { createCard } from "../../../lib/engine";
import { validateNewCard } from "../../../lib/cards";
import { logErro } from "../../../lib/log";

export async function POST(req: Request) {
  const checked = validateNewCard(await req.json());
  if ("error" in checked) {
    logErro("criação de card", checked.error);
    return Response.json({ error: checked.error }, { status: 400 });
  }

  try {
    return Response.json(createCard(checked.fields));
  } catch (erro) {
    logErro("criação de card", erro);
    return Response.json({ error: (erro as Error).message }, { status: 400 });
  }
}
