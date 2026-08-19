// Os anexos são guardados pelo board, fora do workspace do projeto: assim eles
// nunca entram no repositório nem aparecem no diff da PR. O agente recebe o
// caminho local e abre o arquivo direto do disco.
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { logErro } from "./log";

const PASTA_DE_ANEXOS = path.join(process.cwd(), "data", "anexos");
const LIMITE_DO_NOME = 80;
const NOME_VAZIO = "arquivo";
const CARACTERES_PROIBIDOS = /[^\w.\-]+/g;

export interface ArquivoRecebido {
  nome: string;
  tipo: string;
  bytes: Buffer;
}

export interface AnexoSalvo {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  arquivo: string;
  caminho: string;
}

export function pastaDoCard(cardId: string): string {
  return path.join(PASTA_DE_ANEXOS, cardId);
}

export function caminhoDoAnexo(cardId: string, arquivo: string): string {
  return path.join(pastaDoCard(cardId), arquivo);
}

// O nome do arquivo em disco carrega o id na frente: dois anexos com o mesmo
// nome convivem, e nada que o usuário digitou vira caminho.
function nomeEmDisco(id: string, nomeOriginal: string): string {
  const limpo = path
    .basename(nomeOriginal)
    .replace(CARACTERES_PROIBIDOS, "-")
    .replace(/^[-.]+/, "")
    .slice(0, LIMITE_DO_NOME);
  return `${id}-${limpo || NOME_VAZIO}`;
}

// Grava tudo ou nada: um arquivo que falhou no meio deixaria anexos órfãos em
// disco sem linha no banco pra alcançá-los depois.
export async function salvarAnexos(
  cardId: string,
  arquivos: ArquivoRecebido[]
): Promise<AnexoSalvo[]> {
  if (arquivos.length === 0) return [];

  const pasta = pastaDoCard(cardId);
  await fsp.mkdir(pasta, { recursive: true });

  const resultados = await Promise.allSettled(
    arquivos.map(async (arquivo): Promise<AnexoSalvo> => {
      const id = randomUUID();
      const nomeDoArquivo = nomeEmDisco(id, arquivo.nome);
      const caminho = path.join(pasta, nomeDoArquivo);
      await fsp.writeFile(caminho, arquivo.bytes);
      return {
        id,
        nome: arquivo.nome,
        tipo: arquivo.tipo,
        tamanho: arquivo.bytes.byteLength,
        arquivo: nomeDoArquivo,
        caminho,
      };
    })
  );

  const salvos = resultados
    .filter((resultado): resultado is PromiseFulfilledResult<AnexoSalvo> => resultado.status === "fulfilled")
    .map((resultado) => resultado.value);

  const falha = resultados.find((resultado) => resultado.status === "rejected");
  if (falha) {
    logErro(`gravação dos anexos do card ${cardId}`, falha.reason);
    for (const anexo of salvos) removerArquivoDoAnexo(cardId, anexo.arquivo);
    throw falha.reason;
  }

  return salvos;
}

export function removerArquivoDoAnexo(cardId: string, arquivo: string): void {
  try {
    fs.rmSync(caminhoDoAnexo(cardId, arquivo), { force: true });
  } catch (erro) {
    logErro(`remoção do anexo ${arquivo} do card ${cardId}`, erro);
  }
}

// Excluir o card apaga os arquivos. Falhar aqui não pode derrubar a exclusão:
// pasta órfã ocupa disco, card zumbi ocupa o board.
export function removerAnexosDoCard(cardId: string): void {
  try {
    fs.rmSync(pastaDoCard(cardId), { recursive: true, force: true });
  } catch (erro) {
    logErro(`remoção da pasta de anexos do card ${cardId}`, erro);
  }
}
