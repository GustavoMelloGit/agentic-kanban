import { createDir, listDirs } from "../../../lib/fsbrowse";
import { logErro } from "../../../lib/log";

export function GET(req: Request) {
  const caminho = new URL(req.url).searchParams.get("path") ?? undefined;

  try {
    return Response.json(listDirs(caminho));
  } catch (erro) {
    logErro(`listagem de ${caminho ?? "(raiz do app)"}`, erro);
    return Response.json({ error: (erro as Error).message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const { parent, name } = await req.json();
  if (typeof parent !== "string" || typeof name !== "string") {
    return Response.json({ error: "parent e name são obrigatórios" }, { status: 400 });
  }

  try {
    return Response.json(createDir(parent, name));
  } catch (erro) {
    logErro(`criação da pasta ${name} em ${parent}`, erro);
    return Response.json({ error: (erro as Error).message }, { status: 400 });
  }
}
