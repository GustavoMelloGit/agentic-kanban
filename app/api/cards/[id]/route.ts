import { deleteCard } from "../../../../lib/engine";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteCard(id);
  if (!ok) return Response.json({ error: "card not found" }, { status: 404 });
  return Response.json({ ok: true });
}
