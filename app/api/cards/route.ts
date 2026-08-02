import { createCard } from "../../../lib/engine";
import { validateCard } from "../../../lib/cards";
import { logErro } from "../../../lib/log";
import { textoNaoVazio } from "../../../lib/texto";

export async function POST(req: Request) {
  const body = await req.json();
  const checked = validateCard(body, false);
  if ("error" in checked) return Response.json({ error: checked.error }, { status: 400 });

  try {
    return Response.json(
      createCard({
        title: checked.fields.title!,
        description: checked.fields.description,
        projectId: textoNaoVazio(body.projectId) ?? undefined,
      })
    );
  } catch (erro) {
    logErro("criação de card", erro);
    return Response.json({ error: (erro as Error).message }, { status: 400 });
  }
}
