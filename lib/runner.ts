import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import type { Column, Project, Tool, RunEntry, ChatMessage } from "./config";
import { logErro } from "./log";
import { formatTranscript } from "./transcript";
import { semMarcadoresDeCancelamento } from "./cancelamento";
import type { Worktree } from "./worktree";

const TIMEOUT_MS = 10 * 60 * 1000; // 10 min safety cap per run

// The chat is re-spawned every turn (no native session), so this directive
// must go into every turn to keep replies anchored in the real code.
const WORKSPACE_EXPLORATION_DIRECTIVE =
  "You are running inside this project's workspace: the current working directory IS the project. " +
  "Before restating the goal or asking anything, explore the workspace to understand it for real — this is read-only, do NOT modify anything. " +
  "Read the README and any documentation, the dependency manifest (package.json or its equivalent), the folder structure, and the modules relevant to what this card asks for. " +
  "Ground your restatement and every question in what you actually find in the code — the real stack, conventions, current state, and concrete files — never in generic assumptions.";

function gitIsolationSection(worktree: Worktree): string {
  return (
    `\n## Git isolation\n` +
    `Your cwd is a git worktree created for this card alone, already checked out on branch \`${worktree.branch}\`, based on \`${worktree.base}\`. ` +
    `It exists so cards worked in parallel never collide in the same files.\n` +
    `- Stay in this worktree: never switch branches, never edit files outside it, never touch the main checkout.\n` +
    `- The worktree and the branch are managed by the board — do not create or delete either.\n` +
    `- Commit as you go, in Portuguese conventional commits (\`tipo(escopo): descrição\`), one short phrase per commit.`
  );
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
  if (worktree) parts.push(gitIsolationSection(worktree));
  parts.push(`\n## Card: ${card.title}\n${card.description || "(no description)"}`);
  const conversa = semMarcadoresDeCancelamento(card.messages);
  if (conversa.length) {
    parts.push(
      "\n## Requirements discussion (Enrichment)\n" +
        "The user and the analyst agreed on the scope below. Treat these decisions as requirements — " +
        "they refine the card description and, where they conflict with it, win.\n\n" +
        formatTranscript(conversa)
    );
  }
  if (card.history.length) {
    const last = card.history[card.history.length - 1];
    parts.push(`\n## Context from previous stage (${last.column})\n${last.output}`);
  }
  parts.push(`\n## Your task\n${column.instruction}`);
  return parts.join("\n");
}

// Build the prompt for one turn of a chat column. The whole transcript is
// replayed each turn so any CLI works without native session resume.
export function buildChatPrompt(
  column: Column,
  card: { title: string; description: string; messages: ChatMessage[] },
  project: Project
): string {
  const parts: string[] = [];
  if (column.persona) parts.push(`You are ${column.persona}.`);
  parts.push(
    "You are refining a Kanban card through a short back-and-forth with the user. " +
      "Ask focused questions in small batches, progressively filling the gaps. " +
      "Keep replies concise and conversational. Do NOT write code."
  );
  parts.push(WORKSPACE_EXPLORATION_DIRECTIVE);
  parts.push(`Project: ${project.name}`);
  parts.push(`\n## Card\n**${card.title}**\n${card.description || "(no description)"}`);

  const conversa = semMarcadoresDeCancelamento(card.messages);
  if (conversa.length === 0) {
    parts.push(
      `\n## Task\n${column.instruction}\n\nExplore the workspace first as instructed above, then open the conversation: give a brief, code-grounded read of the idea and your first questions.`
    );
  } else {
    const transcript = formatTranscript(conversa, { rotuloDoAgente: "You" });
    parts.push(`\n## Conversation so far\n${transcript}`);
    parts.push(
      "\n## Now\nThis chat is re-spawned from scratch every turn — the transcript above is your only memory, so re-orient yourself in the workspace whenever you need to keep your answers anchored in the real code. " +
        "Respond to the user's latest message. Ask further questions if gaps remain, or — if the requirements now look complete — summarize the finalized requirements and acceptance criteria and say they're ready for development."
    );
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
