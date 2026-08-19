// Leitura dos anexos que chegam por multipart. As duas rotas que recebem
// arquivo (mensagem do chat e anexo do card) passam por aqui, então o limite é
// conferido num lugar só — o front recusa antes pra dar o aviso na hora, mas
// quem decide é o servidor.
import { validarAnexos } from "./anexos";
import type { ArquivoRecebido } from "./anexos-disco";
import { logErro } from "./log";

const CAMPO_DOS_ARQUIVOS = "files";
const TIPO_DESCONHECIDO = "application/octet-stream";

export type EnvioLido = { error: string } | { arquivos: ArquivoRecebido[]; form: FormData };

export async function lerAnexosDaRequisicao(req: Request): Promise<EnvioLido> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch (erro) {
    logErro("leitura do envio com anexos", erro);
    return { error: "envio inválido: esperava multipart/form-data" };
  }

  const enviados = form
    .getAll(CAMPO_DOS_ARQUIVOS)
    .filter((valor): valor is File => valor instanceof File);

  const recusa = validarAnexos(
    enviados.map((arquivo) => ({ name: arquivo.name, size: arquivo.size }))
  );
  if (recusa) return { error: recusa };

  const arquivos = await Promise.all(
    enviados.map(async (arquivo) => ({
      nome: arquivo.name,
      // navegador manda tipo vazio pra extensão que ele não conhece
      tipo: arquivo.type || TIPO_DESCONHECIDO,
      bytes: Buffer.from(await arquivo.arrayBuffer()),
    }))
  );

  return { arquivos, form };
}
