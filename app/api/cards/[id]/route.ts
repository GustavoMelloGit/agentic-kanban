import { deleteCard, updateCard } from "../../../../lib/engine";
import { validateCardPatch } from "../../../../lib/cards";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const checked = validateCardPatch(await req.json());
  if ("error" in checked) return Response.json({ error: checked.error }, { status: 400 });

  const resultado = updateCard(id, checked.fields);
  switch (resultado.situacao) {
    case "card-inexistente":
      return Response.json({ error: "card não encontrado" }, { status: 404 });
    case "agente-ocupado":
      return Response.json(
        { error: "um agente está atuando neste card — aguarde a execução terminar" },
        { status: 409 }
      );
    case "editado":
      return Response.json(resultado.card);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteCard(id);
  if (!ok) return Response.json({ error: "card not found" }, { status: 404 });
  return Response.json({ ok: true });
}
