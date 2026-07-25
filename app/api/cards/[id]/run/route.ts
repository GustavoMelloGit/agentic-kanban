import { runCard } from "../../../../../lib/engine";
import { logErro } from "../../../../../lib/log";

// Redispara o agente da coluna atual do card.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  runCard(id).catch((erro) => logErro(`run manual do card ${id}`, erro));
  return Response.json({ ok: true });
}
