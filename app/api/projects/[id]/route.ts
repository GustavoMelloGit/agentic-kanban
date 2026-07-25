import { countCardsInProject, deleteProject, updateProject } from "../../../../lib/store";
import { validateProject } from "../../../../lib/projects";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const checked = validateProject(await req.json(), true);
  if ("error" in checked) return Response.json({ error: checked.error }, { status: 400 });

  const updated = updateProject(id, checked.fields);
  if (!updated) return Response.json({ error: "projeto não encontrado" }, { status: 404 });
  return Response.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Apagar o projeto deixaria cards órfãos, sem tool nem workspace pra rodar.
  const totalDeCards = countCardsInProject(id);
  if (totalDeCards > 0) {
    return Response.json(
      { error: `o projeto ainda tem ${totalDeCards} card(s); mova ou exclua eles primeiro` },
      { status: 409 }
    );
  }

  if (!deleteProject(id)) return Response.json({ error: "projeto não encontrado" }, { status: 404 });
  return Response.json({ ok: true });
}
