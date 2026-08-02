// Isolamento por card: cada card que roda um agente de código ganha uma git
// worktree própria em .claude/worktrees/<card-id>, com uma branch própria.
// O motor cria antes do spawn e remove quando o card termina — o agente não
// precisa (nem deve) mexer nisso.
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { gerarSlug } from "./slug";
import { logErro } from "./log";

const executarComando = promisify(execFile);

const PASTA_DAS_WORKTREES = path.join(".claude", "worktrees");
const PADRAO_DE_EXCLUSAO = ".claude/worktrees/";
const LIMITE_DO_SLUG = 48;
const TITULO_VAZIO = "sem-titulo";

export interface Worktree {
  caminho: string;
  branch: string;
  base: string;
}

async function git(repositorio: string, argumentos: string[]): Promise<string> {
  const { stdout } = await executarComando("git", argumentos, { cwd: repositorio });
  return stdout.trim();
}

async function gitOpcional(
  repositorio: string,
  argumentos: string[],
  contexto: string
): Promise<string | null> {
  try {
    return await git(repositorio, argumentos);
  } catch (erro) {
    logErro(contexto, erro);
    return null;
  }
}

// Sondagem: aqui o comando falhar é a resposta ("não existe"), não um erro.
// Logar encheria o console de ruído a cada run e esconderia as falhas de verdade.
async function sondarGit(repositorio: string, argumentos: string[]): Promise<string | null> {
  try {
    return await git(repositorio, argumentos);
  } catch {
    return null;
  }
}

// null quando o workspace não é um repositório git: aí não há isolamento
// possível. Quem avisa é o motor, que sabe se o card exigia worktree.
async function raizDoRepositorio(workspace: string): Promise<string | null> {
  return sondarGit(workspace, ["rev-parse", "--show-toplevel"]);
}

function caminhoDaWorktree(raiz: string, cardId: string): string {
  return path.join(raiz, PASTA_DAS_WORKTREES, cardId);
}

function nomeDaBranch(cardId: string, titulo: string): string {
  const slug = gerarSlug(titulo, TITULO_VAZIO).slice(0, LIMITE_DO_SLUG).replace(/-+$/, "");
  return `${cardId}/${slug || TITULO_VAZIO}`;
}

// .git/info/exclude é local e nunca versionado, então a pasta de worktrees some
// do git status de qualquer repositório — não só do deste app, que já a ignora
// pelo .gitignore.
async function ignorarPastaDasWorktrees(raiz: string): Promise<void> {
  const gitDir = await gitOpcional(raiz, ["rev-parse", "--git-common-dir"], `git dir de ${raiz}`);
  if (!gitDir) return;

  const raizDoGit = path.isAbsolute(gitDir) ? gitDir : path.join(raiz, gitDir);
  const arquivo = path.join(raizDoGit, "info", "exclude");
  try {
    const conteudo = fs.existsSync(arquivo) ? fs.readFileSync(arquivo, "utf8") : "";
    if (conteudo.split("\n").some((linha) => linha.trim() === PADRAO_DE_EXCLUSAO)) return;

    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    const separador = !conteudo || conteudo.endsWith("\n") ? "" : "\n";
    fs.appendFileSync(arquivo, `${separador}${PADRAO_DE_EXCLUSAO}\n`);
  } catch (erro) {
    logErro(`exclusão de ${PADRAO_DE_EXCLUSAO} em ${arquivo}`, erro);
  }
}

async function resolverBase(raiz: string): Promise<string> {
  const headRemoto = await sondarGit(raiz, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  if (headRemoto) return headRemoto.replace(/^origin\//, "");

  for (const candidata of ["main", "master"]) {
    if (await sondarGit(raiz, ["rev-parse", "--verify", "--quiet", `refs/heads/${candidata}`])) {
      return candidata;
    }
  }
  return "HEAD";
}

// A worktree do card, se já existir — sem criar nada. Para quem só precisa saber
// em que branch o card está, como a checagem de PR.
export async function worktreeExistente(opts: {
  workspace: string;
  cardId: string;
}): Promise<Worktree | null> {
  const raiz = await raizDoRepositorio(opts.workspace);
  if (!raiz) return null;

  const caminho = caminhoDaWorktree(raiz, opts.cardId);
  if (!fs.existsSync(caminho)) return null;

  const branch = await sondarGit(caminho, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!branch) return null;

  return { caminho, branch, base: await resolverBase(raiz) };
}

// Devolve a worktree do card, criando-a na primeira vez e reaproveitando nas
// seguintes (o card volta pra Development quando o review recusa). null = o
// workspace não é repositório git. Erros de git de verdade sobem.
export async function prepararWorktree(opts: {
  workspace: string;
  cardId: string;
  titulo: string;
}): Promise<Worktree | null> {
  const jaCriada = await worktreeExistente(opts);
  if (jaCriada) return jaCriada;

  const raiz = await raizDoRepositorio(opts.workspace);
  if (!raiz) return null;

  const caminho = caminhoDaWorktree(raiz, opts.cardId);
  await ignorarPastaDasWorktrees(raiz);
  await gitOpcional(raiz, ["worktree", "prune"], `prune de worktrees em ${raiz}`);

  const base = await resolverBase(raiz);
  const branch = nomeDaBranch(opts.cardId, opts.titulo);
  const branchJaExiste = await sondarGit(raiz, [
    "rev-parse",
    "--verify",
    "--quiet",
    `refs/heads/${branch}`,
  ]);

  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  await git(
    raiz,
    branchJaExiste
      ? ["worktree", "add", caminho, branch]
      : ["worktree", "add", caminho, "-b", branch, base]
  );

  return { caminho, branch, base };
}

// Limpeza ao fim da vida do card. Nada aqui é fatal: worktree órfã atrapalha o
// próximo card, mas derrubar a movimentação por causa disso atrapalha mais.
export async function removerWorktree(opts: {
  workspace: string;
  cardId: string;
}): Promise<void> {
  const raiz = await raizDoRepositorio(opts.workspace);
  if (!raiz) return;

  const caminho = caminhoDaWorktree(raiz, opts.cardId);
  if (!fs.existsSync(caminho)) {
    await gitOpcional(raiz, ["worktree", "prune"], `prune de worktrees em ${raiz}`);
    return;
  }

  const branch = await gitOpcional(
    caminho,
    ["rev-parse", "--abbrev-ref", "HEAD"],
    `branch da worktree ${caminho}`
  );

  const removida = await gitOpcional(
    raiz,
    ["worktree", "remove", "--force", caminho],
    `remoção da worktree ${caminho}`
  );
  if (removida === null) {
    try {
      fs.rmSync(caminho, { recursive: true, force: true });
    } catch (erro) {
      logErro(`remoção manual de ${caminho}`, erro);
      return;
    }
    await gitOpcional(raiz, ["worktree", "prune"], `prune de worktrees em ${raiz}`);
  }

  // -d recusa branch não mergeada: trabalho não integrado sobrevive à limpeza.
  if (branch) {
    await gitOpcional(raiz, ["branch", "-d", branch], `remoção da branch ${branch}`);
  }
}
