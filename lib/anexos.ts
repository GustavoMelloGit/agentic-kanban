// Regras de anexo que o compositor no browser e a rota no servidor precisam
// aplicar iguais: o front recusa na hora pra o arquivo não sumir sem aviso, o
// servidor recusa de novo porque o front não é autoridade.
import type { Attachment } from "./config";

export const LIMITE_DE_ANEXOS_POR_ENVIO = 10;
export const LIMITE_DE_BYTES_POR_ANEXO = 25 * 1024 * 1024;

// Sem lista de tipos permitidos de propósito: aceita tudo e deixa o agente
// lidar com o que sabe ler.
export interface ArquivoParaValidar {
  name: string;
  size: number;
}

const UNIDADES = ["B", "kB", "MB", "GB"] as const;

export function formatarTamanho(bytes: number): string {
  let valor = bytes;
  let unidade = 0;
  while (valor >= 1024 && unidade < UNIDADES.length - 1) {
    valor /= 1024;
    unidade++;
  }
  const casas = unidade === 0 || valor >= 100 ? 0 : 1;
  return `${valor.toFixed(casas).replace(".", ",")} ${UNIDADES[unidade]}`;
}

export function ehImagem(mime: string): boolean {
  return mime.startsWith("image/");
}

// Devolve a mensagem de recusa, ou null quando tudo passa.
export function validarAnexos(arquivos: ArquivoParaValidar[]): string | null {
  if (arquivos.length > LIMITE_DE_ANEXOS_POR_ENVIO) {
    return `no máximo ${LIMITE_DE_ANEXOS_POR_ENVIO} arquivos por envio`;
  }

  const grandeDemais = arquivos.find((arquivo) => arquivo.size > LIMITE_DE_BYTES_POR_ANEXO);
  if (grandeDemais) {
    return `"${grandeDemais.name}" tem ${formatarTamanho(grandeDemais.size)} — o limite é ${formatarTamanho(LIMITE_DE_BYTES_POR_ANEXO)} por arquivo`;
  }

  const vazio = arquivos.find((arquivo) => arquivo.size === 0);
  if (vazio) return `"${vazio.name}" está vazio`;

  return null;
}

// Como o anexo aparece no prompt: caminho local primeiro, porque é o que o
// agente usa pra abrir o arquivo; nome e tamanho vêm depois, como referência.
export function descreverAnexo(anexo: Attachment): string {
  return `${anexo.path} (${anexo.name}, ${formatarTamanho(anexo.size)})`;
}
