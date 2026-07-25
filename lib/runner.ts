import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import type { Column, Project, Tool, RunEntry, ChatMessage } from "./config";
import { logErro } from "./log";

const TIMEOUT_MS = 10 * 60 * 1000; // 10 min safety cap per run

export function buildPrompt(
  column: Column,
  card: { title: string; description: string; history: RunEntry[] },
  project: Project
): string {
  const parts: string[] = [];
  if (column.persona) parts.push(`You are ${column.persona}.`);
  parts.push(`Project: ${project.name}`);
  parts.push(`\n## Card: ${card.title}\n${card.description || "(no description)"}`);
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
  parts.push(`Project: ${project.name}`);
  parts.push(`\n## Card\n**${card.title}**\n${card.description || "(no description)"}`);

  if (card.messages.length === 0) {
    parts.push(`\n## Task\n${column.instruction}\n\nOpen the conversation now: give a brief read of the idea and your first questions.`);
  } else {
    const transcript = card.messages
      .map((mensagem) => `${mensagem.role === "user" ? "User" : "You"}: ${mensagem.content}`)
      .join("\n\n");
    parts.push(`\n## Conversation so far\n${transcript}`);
    parts.push(
      "\n## Now\nRespond to the user's latest message. Ask further questions if gaps remain, or — if the requirements now look complete — summarize the finalized requirements and acceptance criteria and say they're ready for development."
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

// Spawn the project's tool headless in its workspace. onSpawn(child) lets the
// caller track/kill it. Resolves with the captured output.
export function runTool(opts: {
  tool: Tool;
  project: Project;
  prompt: string;
  onSpawn?: (child: ChildProcess) => void;
}): Promise<RunResult> {
  return new Promise((resolve) => {
    const cwd = resolveWorkspace(opts.project);
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
