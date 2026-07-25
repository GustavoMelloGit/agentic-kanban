import { sendMessage } from "../../../../../lib/engine";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { text } = await req.json();
  if (!text || !text.trim()) return Response.json({ error: "text required" }, { status: 400 });
  sendMessage(id, text);
  return Response.json({ ok: true });
}
