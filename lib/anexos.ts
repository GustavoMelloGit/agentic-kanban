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

function motivoDeRecusa(arquivo: ArquivoParaValidar): string | null {
  if (arquivo.size > LIMITE_DE_BYTES_POR_ANEXO) {
    return `tem ${formatarTamanho(arquivo.size)} — o limite é ${formatarTamanho(LIMITE_DE_BYTES_POR_ANEXO)} por arquivo`;
  }
  if (arquivo.size === 0) return "está vazio";
  return null;
}

// Devolve a mensagem de recusa, ou null quando tudo passa. É a checagem do
// servidor: ali o lote chega pronto e recusar por inteiro é a resposta certa.
export function validarAnexos(arquivos: ArquivoParaValidar[]): string | null {
  if (arquivos.length > LIMITE_DE_ANEXOS_POR_ENVIO) {
    return `no máximo ${LIMITE_DE_ANEXOS_POR_ENVIO} arquivos por envio`;
  }

  for (const arquivo of arquivos) {
    const motivo = motivoDeRecusa(arquivo);
    if (motivo) return `"${arquivo.name}" ${motivo}`;
  }

  return null;
}

export interface TriagemDeAnexos<T> {
  aceitos: T[];
  recusa: string | null;
}

// A checagem do compositor: separa o que entra do que foi recusado em vez de
// descartar o lote inteiro. Soltar três arquivos onde um estoura o limite anexa
// os outros dois e diz qual ficou de fora — nada some sem o usuário saber.
export function triarAnexos<T extends ArquivoParaValidar>(
  jaAnexados: number,
  novos: readonly T[]
): TriagemDeAnexos<T> {
  const aceitos: T[] = [];
  const recusados: string[] = [];

  for (const arquivo of novos) {
    const motivo = motivoDeRecusa(arquivo);
    if (motivo) {
      recusados.push(`"${arquivo.name}" ${motivo}`);
      continue;
    }
    if (jaAnexados + aceitos.length >= LIMITE_DE_ANEXOS_POR_ENVIO) {
      recusados.push(
        `"${arquivo.name}" passou do limite de ${LIMITE_DE_ANEXOS_POR_ENVIO} arquivos por envio`
      );
      continue;
    }
    aceitos.push(arquivo);
  }

  return { aceitos, recusa: recusados.length > 0 ? recusados.join("; ") : null };
}

// Como o anexo aparece no prompt: caminho local primeiro, porque é o que o
// agente usa pra abrir o arquivo; nome e tamanho vêm depois, como referência.
export function descreverAnexo(anexo: Attachment): string {
  return `${anexo.path} (${anexo.name}, ${formatarTamanho(anexo.size)})`;
}
