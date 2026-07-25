// O browser não entrega caminho de pasta (nem com webkitdirectory nem com
// showDirectoryPicker), então quem lista o disco pro seletor é o servidor.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { logErro } from "./log";

export interface DirEntry {
  name: string;
  path: string;
  display: string;
  git: boolean;
}

export interface Listing {
  path: string;
  display: string;
  parent: string | null;
  entries: DirEntry[];
}

// Não é sandbox — quem alcança a API local já pode disparar agente com
// --dangerously-skip-permissions — mas evita passear pelo disco por acidente.
function raizesPermitidas(): string[] {
  const candidatas = [os.homedir(), process.cwd()]
    .map(caminhoReal)
    .filter((caminho): caminho is string => caminho !== null);
  return [...new Set(candidatas)];
}

function caminhoReal(caminho: string): string | null {
  try {
    return fs.realpathSync(caminho);
  } catch (erro) {
    logErro(`realpath de ${caminho}`, erro);
    return null;
  }
}

function dentroDasRaizes(caminhoAbsoluto: string): boolean {
  return raizesPermitidas().some(
    (raiz) => caminhoAbsoluto === raiz || caminhoAbsoluto.startsWith(raiz + path.sep)
  );
}

// Relativo à raiz do app quando está dentro dela (igual ao seed,
// "workspaces/demo"); absoluto fora.
export function displayPath(caminhoAbsoluto: string): string {
  const relativo = path.relative(process.cwd(), caminhoAbsoluto);
  const dentroDoApp = !relativo.startsWith("..") && !path.isAbsolute(relativo);
  return dentroDoApp ? relativo || "." : caminhoAbsoluto;
}

function ehDiretorio(caminho: string): boolean {
  try {
    return fs.statSync(caminho).isDirectory();
  } catch (erro) {
    logErro(`stat de ${caminho}`, erro);
    return false;
  }
}

function paraAbsoluto(pedido?: string): string {
  const informado = pedido?.trim();
  if (!informado) return process.cwd();
  return path.isAbsolute(informado) ? informado : path.join(process.cwd(), informado);
}

export function listDirs(pedido?: string): Listing {
  const alvo = paraAbsoluto(pedido);
  const caminhoAbsoluto = caminhoReal(alvo);

  if (!caminhoAbsoluto) throw new Error(`diretório não encontrado: ${alvo}`);
  if (!ehDiretorio(caminhoAbsoluto)) throw new Error(`não é um diretório: ${caminhoAbsoluto}`);
  if (!dentroDasRaizes(caminhoAbsoluto)) {
    throw new Error("fora das pastas permitidas (home e a raiz do app)");
  }

  const entries: DirEntry[] = fs
    .readdirSync(caminhoAbsoluto, { withFileTypes: true })
    .filter((entrada) => !entrada.name.startsWith("."))
    .map((entrada) => path.join(caminhoAbsoluto, entrada.name))
    .filter(ehDiretorio)
    .map((caminhoDaPasta) => ({
      name: path.basename(caminhoDaPasta),
      path: caminhoDaPasta,
      display: displayPath(caminhoDaPasta),
      git: fs.existsSync(path.join(caminhoDaPasta, ".git")),
    }))
    .sort((uma, outra) => uma.name.localeCompare(outra.name, "pt-BR"));

  const pai = path.dirname(caminhoAbsoluto);
  return {
    path: caminhoAbsoluto,
    display: displayPath(caminhoAbsoluto),
    parent: pai !== caminhoAbsoluto && dentroDasRaizes(pai) ? pai : null,
    entries,
  };
}

export function createDir(parent: string, name: string): Listing {
  // Sem separador (traversal) e sem ponto inicial (a listagem esconde dotdirs,
  // então a pasta nasceria invisível).
  const nomeLimpo = name.trim().replace(/[/\\]/g, "-").replace(/^\.+/, "");
  if (!nomeLimpo) throw new Error("nome da pasta é obrigatório");

  const pastaPai = caminhoReal(parent);
  if (!pastaPai || !dentroDasRaizes(pastaPai)) throw new Error("pasta pai inválida");

  const novaPasta = path.join(pastaPai, nomeLimpo);
  fs.mkdirSync(novaPasta, { recursive: true });
  return listDirs(novaPasta);
}
