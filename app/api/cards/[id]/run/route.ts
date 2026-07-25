import { runCard } from "../../../../../lib/engine";

// Manually (re)trigger the agent for a card's current column.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  runCard(id).catch((e) => console.error("manual runCard error:", e));
  return Response.json({ ok: true });
}
