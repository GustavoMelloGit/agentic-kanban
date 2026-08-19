import fsp from "node:fs/promises";
import { caminhoDoAnexo } from "../../../../lib/anexos-disco";
import { detachFromCard } from "../../../../lib/engine";
import { logErro } from "../../../../lib/log";
import { getAttachmentRow } from "../../../../lib/store";

// O arquivo é do usuário e o board o serve na própria origem, então um HTML
// anexado rodaria script aqui dentro se abrisse inline. Só o que o navegador
// desenha sem executar nada abre na aba; o resto baixa.
const TIPOS_QUE_ABREM_NA_ABA = ["image/", "application/pdf", "text/plain", "video/", "audio/"];

function disposicao(mime: string): "inline" | "attachment" {
  return TIPOS_QUE_ABREM_NA_ABA.some((tipo) => mime.startsWith(tipo)) ? "inline" : "attachment";
}

// filename* carrega o nome original com acento; o filename simples fica como
// alternativa pra cliente antigo, sem aspas nem barra pra não quebrar o header.
function cabecalhoDeNome(mime: string, nome: string): string {
  const asciiSeguro = nome.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${disposicao(mime)}; filename="${asciiSeguro}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const anexo = getAttachmentRow(id);
  if (!anexo) return Response.json({ error: "anexo não encontrado" }, { status: 404 });

  try {
    const conteudo = await fsp.readFile(caminhoDoAnexo(anexo.cardId, anexo.file));
    return new Response(new Uint8Array(conteudo), {
      headers: {
        "Content-Type": anexo.mime,
        "Content-Length": String(conteudo.byteLength),
        "Content-Disposition": cabecalhoDeNome(anexo.mime, anexo.name),
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (erro) {
    logErro(`leitura do anexo ${id}`, erro);
    return Response.json({ error: "arquivo do anexo não encontrado" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!detachFromCard(id)) {
    return Response.json(
      { error: "anexo não encontrado ou preso a uma mensagem já enviada" },
      { status: 404 }
    );
  }
  return Response.json({ ok: true });
}
