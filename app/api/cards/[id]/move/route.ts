import { moveCard } from "../../../../../lib/engine";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { toColumnId } = await req.json();
  try {
    await moveCard(id, toColumnId);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
