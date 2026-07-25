import { createCard } from "../../../lib/engine";

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.title) return Response.json({ error: "title required" }, { status: 400 });
  const card = createCard(body);
  return Response.json(card);
}
