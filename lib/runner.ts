import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { COLUMNS, type Column, type Project, type Tool, type RunEntry, type ChatMessage } from "./config";
import { logErro } from "./log";
import { formatTranscript } from "./transcript";
import { semMarcadoresDeCancelamento, ultimaEtapaSemCancelamento } from "./cancelamento";
import type { Worktree } from "./worktree";

const TIMEOUT_MS = 10 * 60 * 1000; // 10 min safety cap per run

// Só quem escreve código commita: a coluna de chat lê a mesma worktree e sairia
// commitando por conta própria se herdasse esta regra.
const COMMIT_RULE =
  "\n- Commit as you go, in Portuguese conventional commits (`tipo(escopo): descrição`), one short phrase per commit.";

const CHAT_TURN_PREAMBLE =
  "This chat is re-spawned from scratch every turn — the transcript above is your only memory, " +
  "so re-orient yourself in the code whenever you need to keep your answers anchored in what is really there.";

function gitIsolationSection(worktree: Worktree): string {
  return (
    `\n## Git isolation\n` +
    `Your cwd is a git worktree created for this card alone, already checked out on branch \`${worktree.branch}\`, based on \`${worktree.base}\`. ` +
    `It exists so cards worked in parallel never collide in the same files.\n` +
    `- Stay in this worktree: never switch branches, never edit files outside it, never touch the main checkout.\n` +
    `- The worktree and the branch are managed by the board — do not create or delete either.`
  );
}

function nomeDaColuna(id: string): string {
  return COLUMNS.find((coluna) => coluna.id === id)?.name ?? id;
}

export function buildPrompt(
  column: Column,
  card: { title: string; description: string; history: RunEntry[]; messages: ChatMessage[] },
  project: Project,
  worktree?: Worktree
): string {
  const parts: string[] = [];
  if (column.persona) parts.push(`You are ${column.persona}.`);
  parts.push(`Project: ${project.name}`);
  if (worktree) parts.push(gitIsolationSection(worktree) + COMMIT_RULE);
  parts.push(`\n## Card: ${card.title}\n${card.description || "(no description)"}`);
  const conversa = semMarcadoresDeCancelamento(card.messages);
  if (conversa.length) {
    // Rótulo neutro de propósito: o thread junta o refinamento com a conversa da
    // revisão humana, e o pedido autoritativo chega pelo histórico, não por aqui.
    parts.push(
      "\n## Conversation with the user\n" +
        "The scope below was agreed with the user in this card's conversation. Treat these decisions as requirements — " +
        "they refine the card description and, where they conflict with it, win.\n\n" +
        formatTranscript(conversa)
    );
  }
  const etapaAnterior = ultimaEtapaSemCancelamento(card.history);
  if (etapaAnterior) {
    parts.push(
      `\n## Context from previous stage (${nomeDaColuna(etapaAnterior.column)})\n${etapaAnterior.output}`
    );
  }
  parts.push(`\n## Your task\n${column.instruction}`);
  return parts.join("\n");
}

// Build the prompt for one turn of a chat column. The whole transcript is
// replayed each turn so any CLI works without native session resume. What is
// specific to the column comes from its `chatPrompt`; the scaffolding is here.
export function buildChatPrompt(
  column: Column,
  card: { title: string; description: string; messages: ChatMessage[] },
  project: Project,
  worktree?: Worktree
): string {
  const parts: string[] = [];
  if (column.persona) parts.push(`You are ${column.persona}.`);
  if (column.chatPrompt) parts.push(column.chatPrompt.briefing);
  parts.push(`Project: ${project.name}`);
  if (worktree) parts.push(gitIsolationSection(worktree));
  parts.push(`\n## Card\n**${card.title}**\n${card.description || "(no description)"}`);

  const conversa = semMarcadoresDeCancelamento(card.messages);
  if (conversa.length === 0) {
    // A `instruction` é o turno de abertura, não protocolo de todo turno: repetir
    // ela no meio da conversa briga com a `continuation`.
    const abertura = [
      column.instruction && `## Task\n${column.instruction}`,
      column.chatPrompt?.opening,
    ]
      .filter(Boolean)
      .join("\n\n");
    if (abertura) parts.push(`\n${abertura}`);
  } else {
    const transcript = formatTranscript(conversa, {
      rotuloDoAgente: column.chatPrompt?.agentLabel,
    });
    parts.push(`\n## Conversation so far\n${transcript}`);
    const agora = [CHAT_TURN_PREAMBLE, column.chatPrompt?.continuation].filter(Boolean).join(" ");
    parts.push(`\n## Now\n${agora}`);
  }
  return parts.join("\n");
}

// Recusa arquivo: sem isso o erro só apareceria depois, como falha de spawn.
export function ensureWorkspaceDir(workspace: string): string {
  const caminhoAbsoluto = path.isAbsolute(workspace)
    ? workspace
    : path.join(process.cwd(), workspace);

  if (fs.existsSync(caminhoAbsoluto)) {
    if (!fs.statSync(caminhoAbsoluto).isDirectory()) {
      throw new Error(`workspace não é um diretório: ${caminhoAbsoluto}`);
    }
  } else {
    fs.mkdirSync(caminhoAbsoluto, { recursive: true });
  }
  return caminhoAbsoluto;
}

function resolveWorkspace(project: Project): string {
  return ensureWorkspaceDir(project.workspace);
}

// A CLI dá spawn em subprocessos, então mata o grupo (pid negativo) inteiro.
export function killTree(child: ChildProcess | undefined) {
  if (!child || child.pid == null) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch (erroGrupo) {
    logErro(`kill do grupo ${child.pid}`, erroGrupo);
    try {
      child.kill("SIGKILL");
    } catch (erroProcesso) {
      logErro(`kill do processo ${child.pid} (provavelmente já morreu)`, erroProcesso);
    }
  }
}

export interface RunResult {
  ok: boolean;
  output: string;
}

// Spawn the project's tool headless in its workspace — or in `cwd`, when the
// column gave the card a worktree of its own. onSpawn(child) lets the caller
// track/kill it. Resolves with the captured output.
export function runTool(opts: {
  tool: Tool;
  project: Project;
  prompt: string;
  cwd?: string;
  onSpawn?: (child: ChildProcess) => void;
}): Promise<RunResult> {
  return new Promise((resolve) => {
    const cwd = opts.cwd ?? resolveWorkspace(opts.project);
    const args = opts.tool.args.map((argumento) => argumento.replace("{{prompt}}", opts.prompt));

    const child = spawn(opts.tool.command, args, {
      cwd,
      env: process.env,
      detached: true, // grupo próprio, pra killTree derrubar a árvore inteira
    });
    opts.onSpawn?.(child);

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => killTree(child), TIMEOUT_MS);

    child.stdout?.on("data", (pedaco) => (stdout += pedaco.toString()));
    child.stderr?.on("data", (pedaco) => (stderr += pedaco.toString()));

    child.on("error", (erro) => {
      clearTimeout(timer);
      logErro(`spawn de "${opts.tool.command}"`, erro);
      resolve({ ok: false, output: `Failed to spawn "${opts.tool.command}": ${erro.message}` });
    });

    child.on("close", (codigoSaida) => {
      clearTimeout(timer);
      const saida = (stdout || stderr || "").trim();
      if (codigoSaida !== 0) logErro(`${opts.tool.command} saiu com código ${codigoSaida}`, saida);
      resolve({ ok: codigoSaida === 0, output: saida || `(no output, exit code ${codigoSaida})` });
    });
  });
}
