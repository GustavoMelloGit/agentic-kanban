import { attachToCard } from "../../../../../lib/engine";
import { lerAnexosDaRequisicao } from "../../../../../lib/anexos-requisicao";
import { logErro } from "../../../../../lib/log";

// Anexo do card, independente de mensagem: vale pro card inteiro e entra em
// todo disparo dele, em qualquer coluna.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const envio = await lerAnexosDaRequisicao(req);
  if ("error" in envio) {
    logErro("anexo no card", `card ${id}: ${envio.error}`);
    return Response.json({ error: envio.error }, { status: 400 });
  }

  if (envio.arquivos.length === 0) {
    return Response.json({ error: "nenhum arquivo enviado" }, { status: 400 });
  }

  const resultado = await attachToCard(id, envio.arquivos);
  switch (resultado.situacao) {
    case "card-inexistente":
      return Response.json({ error: "card não encontrado" }, { status: 404 });
    case "falha-ao-salvar":
      return Response.json({ error: "não foi possível gravar os anexos" }, { status: 500 });
    case "anexado":
      return Response.json(resultado.anexos);
  }
}
