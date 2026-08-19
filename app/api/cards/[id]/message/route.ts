import { sendMessage } from "../../../../../lib/engine";
import { lerAnexosDaRequisicao } from "../../../../../lib/anexos-requisicao";
import { casoNaoTratado } from "../../../../../lib/exaustividade";
import { logErro } from "../../../../../lib/log";

// multipart, não JSON: a mensagem pode vir com arquivo junto, e o anexo entra
// no mesmo envio pra não existir mensagem sem os arquivos dela.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const envio = await lerAnexosDaRequisicao(req);
  if ("error" in envio) {
    logErro("envio de mensagem", `card ${id}: ${envio.error}`);
    return Response.json({ error: envio.error }, { status: 400 });
  }

  const resultado = await sendMessage(id, envio.form.get("text"), envio.arquivos);
  switch (resultado) {
    case "card-inexistente":
      return Response.json({ error: "card não encontrado" }, { status: 404 });
    case "coluna-sem-chat":
      return Response.json({ error: "o card não está numa coluna de chat" }, { status: 409 });
    case "mensagem-vazia":
      return Response.json({ error: "escreva uma mensagem ou anexe um arquivo" }, { status: 400 });
    case "agente-ocupado":
      return Response.json(
        { error: "o agente ainda está respondendo — aguarde o turno terminar" },
        { status: 409 }
      );
    case "falha-ao-salvar-anexo":
      return Response.json({ error: "não foi possível gravar os anexos" }, { status: 500 });
    case "enviada":
      return Response.json({ ok: true });
    default:
      casoNaoTratado("envio de mensagem", resultado);
      return Response.json({ error: "não foi possível enviar a mensagem" }, { status: 500 });
  }
}
