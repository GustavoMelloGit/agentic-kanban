import { moveCard } from "../../../../../lib/engine";
import { logErro } from "../../../../../lib/log";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { toColumnId } = await req.json();

  try {
    await moveCard(id, toColumnId);
    return Response.json({ ok: true });
  } catch (erro) {
    logErro(`move do card ${id} para ${toColumnId}`, erro);
    return Response.json({ error: (erro as Error).message }, { status: 400 });
  }
}
