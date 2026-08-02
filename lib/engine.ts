import type { ChildProcess } from "node:child_process";
import {
  getBoard,
  getColumn,
  getProject,
  getCardRow,
  setCardStatus,
  setCardColumn,
  addRun,
  addMessage,
  getMessages,
  setReviewCycles,
  createCard as storeCreateCard,
  deleteCard as storeDeleteCard,
} from "./store";
import { buildPrompt, buildChatPrompt, runTool, killTree } from "./runner";
import { MAX_REVIEW_CYCLES, type Card, type Column } from "./config";
import { parseVerdict } from "./verdict";
import { logErro } from "./log";

// In-process state (single-process dev prototype).
const running = new Set<string>();
const children = new Map<string, ChildProcess>();
const jobs = new Map<string, Promise<void>>();
const cancelled = new Set<string>();

function nowStamp() {
  return new Date().toISOString();
}

// Register a running job so cancelCard() can await it. Um segundo job para o
// mesmo card é encadeado no anterior — sobrescrever faria cancelCard() esperar
// o job errado.
function register(id: string, work: Promise<void>) {
  const jobAnterior = jobs.get(id);
  const trabalhoLogado = work.catch((erro) => logErro(`agente do card ${id}`, erro));
  const jobRastreado: Promise<void> = (
    jobAnterior
      ? Promise.allSettled([jobAnterior, trabalhoLogado]).then(() => undefined)
      : trabalhoLogado
  ).finally(() => {
    if (jobs.get(id) === jobRastreado) jobs.delete(id);
  });
  jobs.set(id, jobRastreado);
}

function agenteOcupado(id: string): boolean {
  return running.has(id) || jobs.has(id);
}

function startAgent(id: string, columnId: string) {
  register(id, runCard(id, columnId));
}

function startChatTurn(id: string) {
  register(id, runChatTurn(id));
}

// Move a card to a column. If the card is mid-run, its agent is cancelled first.
// `chained` marks moves the engine itself decided (autonomous hand-off, review
// bounce); a move without it came from a human, which resets the review budget.
export async function moveCard(id: string, toColumnId: string, opts: { chained?: boolean } = {}) {
  const col = getColumn(toColumnId);
  if (!col) throw new Error(`column not found: ${toColumnId}`);
  const card = getCardRow(id);

  if (card && card.status === "running") {
    await cancelCard(id); // kill the agent before the card leaves the column
  }

  if (!opts.chained && card && card.reviewCycles > 0) setReviewCycles(id, 0);

  setCardColumn(id, toColumnId);

  // autonomous + automated columns run an agent on arrival
  if (col.type === "autonomous" || col.type === "automated") {
    if (col.chat) {
      // open the conversation only if the thread is empty (don't re-open on re-entry)
      if (getMessages(id).length === 0) startChatTurn(id);
    } else {
      startAgent(id, toColumnId);
    }
  }
}

export type ResultadoDeMensagem =
  | "enviada"
  | "card-inexistente"
  | "coluna-sem-chat"
  | "mensagem-vazia"
  | "agente-ocupado";

// User sends a message in a chat column; the agent replies in a new turn.
// Fora de uma coluna de chat a resposta seria montada com a persona e a
// instruction da coluna atual — em Development, um agente que edita código.
export function sendMessage(id: string, text: string): ResultadoDeMensagem {
  const cardRow = getCardRow(id);
  if (!cardRow) {
    logErro("envio de mensagem", `card não encontrado: ${id}`);
    return "card-inexistente";
  }

  const coluna = getColumn(cardRow.columnId);
  if (!coluna?.chat) {
    logErro("envio de mensagem", `card ${id} está em "${cardRow.columnId}", que não é coluna de chat`);
    return "coluna-sem-chat";
  }

  const textoDaMensagem = text.trim();
  if (!textoDaMensagem) {
    logErro("envio de mensagem", `mensagem vazia para o card ${id}`);
    return "mensagem-vazia";
  }

  if (agenteOcupado(id)) {
    logErro("envio de mensagem", `card ${id} já tem um turno em andamento; mensagem recusada`);
    return "agente-ocupado";
  }

  addMessage(id, "user", textoDaMensagem);
  startChatTurn(id);
  return "enviada";
}

// Cancel the agent currently working a card. Resolves once cleanup is done.
export async function cancelCard(id: string): Promise<boolean> {
  if (!running.has(id)) return false;
  cancelled.add(id);
  killTree(children.get(id));
  const job = jobs.get(id);
  if (job) await job; // wait until runCard has fully unwound
  return true;
}

// Run the agent for a card in the given column.
export async function runCard(id: string, columnId?: string) {
  if (running.has(id)) return;
  running.add(id);

  let chainTo: string | null = null;
  try {
    const cardRow = getCardRow(id);
    if (!cardRow) return;
    const col = getColumn(columnId ?? cardRow.columnId);
    if (!col) return;
    const project = getProject(cardRow.projectId);
    const board = getBoard();
    const tool = project ? board.tools[project.tool] : undefined;

    if (!project || !tool) {
      setCardStatus(id, "error");
      addRun({
        cardId: id,
        column: col.id,
        output: `Unknown tool/project for card ${id}`,
        at: nowStamp(),
      });
      return;
    }

    setCardStatus(id, "running");

    const cardDoBoard = board.cards.find((card) => card.id === id);
    const cardForPrompt: Pick<Card, "title" | "description" | "history" | "messages"> = {
      title: cardRow.title,
      description: cardRow.description,
      history: cardDoBoard?.history ?? [],
      messages: cardDoBoard?.messages ?? [],
    };
    const prompt = buildPrompt(col, cardForPrompt, project);

    const result = await runTool({
      tool,
      project,
      prompt,
      onSpawn: (child) => {
        children.set(id, child);
        if (cancelled.has(id)) killTree(child); // cancel arrived before spawn
      },
    });
    children.delete(id);

    // Cancelled by the user: record it, don't error, don't chain onward.
    if (cancelled.has(id)) {
      cancelled.delete(id);
      setCardStatus(id, "idle");
      addRun({
        cardId: id,
        column: col.id,
        tool: project.tool,
        ok: false,
        output: "⚠ Execução cancelada pelo usuário (card movido durante a atuação do agente).",
        at: nowStamp(),
      });
      return;
    }

    setCardStatus(id, result.ok ? "idle" : "error");
    addRun({
      cardId: id,
      column: col.id,
      tool: project.tool,
      ok: result.ok,
      output: result.output.slice(0, 20000),
      at: nowStamp(),
    });

    // Only "autonomous" columns move the card onward when the agent finishes.
    if (result.ok && col.type === "autonomous") {
      chainTo = routeAfterRun(id, col, result.output);
    }
  } finally {
    running.delete(id);
    children.delete(id);
  }

  // Chain AFTER releasing the lock, so the next column's agent can actually start.
  if (chainTo) await moveCard(id, chainTo, { chained: true });
}

function routeAfterRun(id: string, col: Column, output: string): string | null {
  if (!col.verdict || !col.onReject) return col.onComplete;

  const verdict = parseVerdict(output);
  if (verdict === null) {
    addRun({
      cardId: id,
      column: col.id,
      ok: false,
      output: `⚠ Veredito não reconhecido na saída do review — seguindo para ${col.onComplete} para revisão humana.`,
      at: nowStamp(),
    });
    return col.onComplete;
  }
  if (verdict === "APPROVE") return col.onComplete;

  const ciclosGastos = getCardRow(id)?.reviewCycles ?? 0;
  if (ciclosGastos >= MAX_REVIEW_CYCLES) {
    addRun({
      cardId: id,
      column: col.id,
      ok: false,
      output:
        `⚠ CHANGES_REQUESTED, mas o limite de ${MAX_REVIEW_CYCLES} ciclos ${col.onReject}↔${col.id} ` +
        `foi atingido. O card para em ${col.onComplete} para decisão humana.`,
      at: nowStamp(),
    });
    return col.onComplete;
  }

  setReviewCycles(id, ciclosGastos + 1);
  return col.onReject;
}

// One turn of a chat column: build the transcript prompt, get the agent's reply,
// store it as an "agent" message. Shares the cancel machinery with runCard.
async function runChatTurn(id: string) {
  if (running.has(id)) {
    logErro("turno de chat", `card ${id} já tem um agente em execução; turno descartado`);
    return;
  }
  running.add(id);

  try {
    const cardRow = getCardRow(id);
    if (!cardRow) return;
    const col = getColumn(cardRow.columnId);
    if (!col) return;
    const project = getProject(cardRow.projectId);
    const board = getBoard();
    const tool = project ? board.tools[project.tool] : undefined;

    if (!project || !tool) {
      setCardStatus(id, "idle");
      addMessage(id, "agent", `⚠ Tool/project inválido para o card ${id}.`);
      return;
    }

    setCardStatus(id, "running");

    const cardForPrompt = {
      title: cardRow.title,
      description: cardRow.description,
      messages: board.cards.find((card) => card.id === id)?.messages ?? [],
    };
    const prompt = buildChatPrompt(col, cardForPrompt, project);

    const result = await runTool({
      tool,
      project,
      prompt,
      onSpawn: (child) => {
        children.set(id, child);
        if (cancelled.has(id)) killTree(child);
      },
    });
    children.delete(id);

    if (cancelled.has(id)) {
      cancelled.delete(id);
      setCardStatus(id, "idle");
      addMessage(id, "agent", "⚠ (resposta cancelada — card movido durante a conversa)");
      return;
    }

    setCardStatus(id, result.ok ? "idle" : "error");
    addMessage(id, "agent", result.output);
  } finally {
    running.delete(id);
    children.delete(id);
  }
}

export function createCard(input: { title: string; description?: string; projectId?: string }) {
  return storeCreateCard(input);
}

// Delete a card. A running agent is killed first, so nothing writes back a
// status/run for a card that no longer exists.
export async function deleteCard(id: string): Promise<boolean> {
  await cancelCard(id);
  return storeDeleteCard(id);
}
