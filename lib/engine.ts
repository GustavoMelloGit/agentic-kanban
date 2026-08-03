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
  updateCard as storeUpdateCard,
  deleteCard as storeDeleteCard,
} from "./store";
import { buildPrompt, buildChatPrompt, runTool, killTree, ensureWorkspaceDir } from "./runner";
import {
  MAX_REVIEW_CYCLES,
  colunaRodaAgente,
  type Card,
  type Column,
  type Project,
} from "./config";
import { semTurnoParaRodar } from "./disparo";
import { registrarExecucao, encerrarExecucao, temAgenteVivo } from "./execucoes";
import { parseVerdict, separarVeredito, notaDeDevolucao } from "./verdict";
import { logErro } from "./log";
import { textoNaoVazio } from "./texto";
import {
  prepararWorktree,
  removerWorktree,
  worktreeExistente,
  type Worktree,
} from "./worktree";
import { consultarPr, descreverConsultaDePr } from "./pr";
import { MARCADORES_DE_CANCELAMENTO, type MotivoDeCancelamento } from "./cancelamento";

// In-process state (single-process dev prototype). Quais cards têm agente vivo
// vive em ./execucoes, porque o board também consulta — e, como lá, este estado
// mora no globalThis: o processo filho sobrevive ao hot-reload do módulo em dev,
// então o handle pra matá-lo e o job pra esperar têm que sobreviver junto. Se um
// dos três se perdesse, o board mostraria "rodando" um agente órfão que o
// cancelamento não alcança mais.
const estadoGlobal = globalThis as unknown as {
  __children?: Map<string, ChildProcess>;
  __jobs?: Map<string, Promise<void>>;
  __cancelled?: Map<string, MotivoDeCancelamento>;
};

const children: Map<string, ChildProcess> =
  estadoGlobal.__children ?? (estadoGlobal.__children = new Map());
const jobs: Map<string, Promise<void>> =
  estadoGlobal.__jobs ?? (estadoGlobal.__jobs = new Map());
const cancelled: Map<string, MotivoDeCancelamento> =
  estadoGlobal.__cancelled ?? (estadoGlobal.__cancelled = new Map());

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
  return temAgenteVivo(id) || jobs.has(id);
}

// Worktree órfã atrapalha o próximo card, mas derrubar a movimentação por causa
// dela atrapalha mais — por isso a limpeza só loga e segue.
async function limparWorktree(id: string, project: Project | undefined) {
  if (!project) {
    logErro("limpeza de worktree", `card ${id} sem projeto; worktree pode ter ficado órfã`);
    return;
  }
  try {
    await removerWorktree({ workspace: ensureWorkspaceDir(project.workspace), cardId: id });
  } catch (erro) {
    logErro(`limpeza da worktree do card ${id}`, erro);
  }
}

// Abrir a PR é instrução de prompt, e prompt não é garantia. Ao chegar em revisão
// humana o motor confere e escreve o desfecho no histórico — com link quando
// existe, com aviso quando não existe.
async function registrarPr(id: string, columnId: string, project: Project | undefined) {
  if (!project) {
    logErro("checagem de PR", `card ${id} sem projeto; PR não verificada`);
    return;
  }

  try {
    const worktree = await worktreeExistente({
      workspace: ensureWorkspaceDir(project.workspace),
      cardId: id,
    });
    // sem worktree o card nunca passou por uma coluna de código: não há branch
    // pra ter PR, e cobrar uma seria ruído no histórico
    if (!worktree) return;

    const consulta = await consultarPr({
      repositorio: worktree.caminho,
      branch: worktree.branch,
    });

    addRun({
      cardId: id,
      column: columnId,
      ok: consulta.situacao === "encontrada",
      output: descreverConsultaDePr(consulta, worktree.branch),
      at: nowStamp(),
    });
  } catch (erro) {
    logErro(`checagem de PR do card ${id}`, erro);
  }
}

// O marcador vai no canal em que o usuário está olhando: thread na coluna de
// chat, histórico nas demais.
function registrarCancelamento(
  id: string,
  columnId: string,
  motivo: MotivoDeCancelamento,
  tool?: string
) {
  const marcadores = MARCADORES_DE_CANCELAMENTO[motivo];

  if (getColumn(columnId)?.chat) {
    addMessage(id, "agent", marcadores.chat);
    return;
  }

  addRun({
    cardId: id,
    column: columnId,
    tool,
    ok: false,
    output: marcadores.historico,
    at: nowStamp(),
  });
}

// O cancelamento vence qualquer outro desfecho do run: o usuário mandou parar,
// então o card volta pra `idle` com o marcador em vez de terminar em `error` — e
// o motivo sai da memória pra não contaminar a próxima execução.
function consumirCancelamento(id: string, columnId: string, tool?: string): boolean {
  const motivo = cancelled.get(id);
  if (!motivo) return false;

  cancelled.delete(id);
  setCardStatus(id, "idle");
  registrarCancelamento(id, columnId, motivo, tool);
  return true;
}

// Execução que morreu junto com o processo (restart, queda) deixa o card
// "running" no banco sem agente pra terminá-la. Destravar é só corrigir o
// status: ninguém cancelou nada, então nenhum marcador vai pro histórico.
function destravarCardFantasma(id: string, contexto: string) {
  logErro(
    contexto,
    `card ${id} estava "running" sem agente em execução (provável restart do servidor); status destravado`
  );
  setCardStatus(id, "idle");
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
    // kill the agent before the card leaves the column; sem agente vivo, o
    // "running" é fantasma e sai daqui destravado — numa coluna manual não
    // sobraria nenhuma ação capaz de desfazê-lo
    const cancelada = await cancelCard(id, "movimentacao");
    if (!cancelada) destravarCardFantasma(id, "movimentação de card");
  }

  if (!opts.chained && card && card.reviewCycles > 0) setReviewCycles(id, 0);

  setCardColumn(id, toColumnId);

  // fora do await: a consulta ao `gh` vai na rede e seguraria o drag-and-drop.
  // O resultado chega no histórico pelo SSE, e registrarPr não rejeita.
  if (col.requiresPr && card) {
    void registrarPr(id, col.id, getProject(card.projectId));
  }

  if (col.dropWorktree && card) {
    await limparWorktree(id, getProject(card.projectId));
  }

  dispararNaChegada(id, col);
}

// autonomous + automated columns run an agent on arrival — vale tanto pra card
// que chegou movido quanto pra card criado direto na coluna.
function dispararNaChegada(id: string, col: Column) {
  if (col.type !== "autonomous" && col.type !== "automated") return;

  if (col.chat) {
    // open the conversation only if the thread is empty (don't re-open on re-entry).
    // Sem filtrar marcador de cancelamento de propósito: thread com marcador já
    // teve abertura, e reabrir aqui responderia por cima do que o usuário parou.
    if (getMessages(id).length === 0) startChatTurn(id);
    return;
  }
  startAgent(id, col.id);
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
export function sendMessage(id: string, text: unknown): ResultadoDeMensagem {
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

  const textoDaMensagem = textoNaoVazio(text);
  if (!textoDaMensagem) {
    logErro(
      "envio de mensagem",
      `mensagem inválida para o card ${id}: esperava texto não vazio, veio ${typeof text}`
    );
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

export type ResultadoDeExecucao =
  | "iniciada"
  | "agente-ocupado"
  | "card-inexistente"
  | "coluna-sem-agente"
  | "sem-turno-para-rodar";

// Redispara o agente da coluna atual fora do ciclo da requisição: a rota responde
// na hora e o SSE empurra o desfecho. O resultado só diz se o disparo aconteceu.
// Numa coluna de chat o disparo refaz o último turno — o mesmo caminho de uma
// mensagem nova, sem exigir que o usuário digite outra pra destravar a conversa.
export function startRun(id: string): ResultadoDeExecucao {
  const cardRow = getCardRow(id);
  if (!cardRow) {
    logErro("run manual", `card não encontrado: ${id}`);
    return "card-inexistente";
  }

  const coluna = getColumn(cardRow.columnId);
  if (!colunaRodaAgente(coluna)) {
    logErro("run manual", `card ${id} está em "${cardRow.columnId}", coluna sem agente; run recusado`);
    return "coluna-sem-agente";
  }

  if (semTurnoParaRodar(coluna, getMessages(id))) {
    logErro(
      "run manual",
      `card ${id} está em "${coluna.id}" sem turno pendente pra refazer; run recusado`
    );
    return "sem-turno-para-rodar";
  }

  if (agenteOcupado(id)) {
    logErro("run manual", `card ${id} já tem um agente em execução; run recusado`);
    return "agente-ocupado";
  }

  if (coluna.chat) startChatTurn(id);
  else startAgent(id, coluna.id);
  return "iniciada";
}

// Cancel the agent currently working a card. Resolves once cleanup is done.
export async function cancelCard(id: string, motivo: MotivoDeCancelamento): Promise<boolean> {
  if (!temAgenteVivo(id)) return false;
  cancelled.set(id, motivo);
  killTree(children.get(id));
  const job = jobs.get(id);
  if (job) await job; // wait until runCard has fully unwound
  cancelled.delete(id); // run que saiu antes de consumir o motivo não contamina o próximo
  return true;
}

export type ResultadoDeCancelamento =
  | "cancelada"
  | "destravada"
  | "nada-para-cancelar"
  | "card-inexistente";

// Interrompe o que o card estiver fazendo, sem exigir que ele mude de coluna.
// Execução que morreu com o processo não chega mais aqui — o board já mostra
// esse card como falha e oferece o "rodar de novo" —, mas o destravamento fica
// como saída de emergência. Sem marcador de cancelamento: ninguém cancelou nada,
// e gravar um seria mentir no histórico.
export async function cancelarOperacao(id: string): Promise<ResultadoDeCancelamento> {
  const cardRow = getCardRow(id);
  if (!cardRow) {
    logErro("cancelamento de operação", `card não encontrado: ${id}`);
    return "card-inexistente";
  }

  if (await cancelCard(id, "cancelamento")) return "cancelada";
  if (cardRow.status !== "running") return "nada-para-cancelar";

  destravarCardFantasma(id, "cancelamento de operação");
  return "destravada";
}

// Run the agent for a card in the given column.
export async function runCard(id: string, columnId?: string) {
  if (temAgenteVivo(id)) {
    logErro("execução do card", `card ${id} já tem um agente em execução; execução descartada`);
    return;
  }
  registrarExecucao(id);

  let chainTo: string | null = null;
  try {
    const cardRow = getCardRow(id);
    if (!cardRow) {
      logErro("execução do card", `card não encontrado: ${id}`);
      return;
    }
    const col = getColumn(columnId ?? cardRow.columnId);
    if (!col) {
      logErro("execução do card", `coluna não encontrada: ${columnId ?? cardRow.columnId}`);
      return;
    }
    const project = getProject(cardRow.projectId);
    const board = getBoard();
    const tool = project ? board.tools[project.tool] : undefined;

    if (!project || !tool) {
      setCardStatus(id, "error");
      addRun({
        cardId: id,
        column: col.id,
        ok: false,
        output: `Unknown tool/project for card ${id}`,
        at: nowStamp(),
      });
      return;
    }

    setCardStatus(id, "running");

    let worktree: Worktree | null = null;
    if (col.worktree) {
      const workspace = ensureWorkspaceDir(project.workspace);
      try {
        worktree = await prepararWorktree({ workspace, cardId: id, titulo: cardRow.title });
      } catch (erro) {
        logErro(`worktree do card ${id}`, erro);
        // cancelar durante o preparo derruba o git: sem isso o card pararia em
        // `error`, com a falha da worktree no lugar do desfecho que o usuário pediu
        if (consumirCancelamento(id, col.id, project.tool)) return;
        setCardStatus(id, "error");
        addRun({
          cardId: id,
          column: col.id,
          tool: project.tool,
          ok: false,
          output: `⚠ Não foi possível preparar a worktree do card: ${erro instanceof Error ? erro.message : String(erro)}`,
          at: nowStamp(),
        });
        return;
      }
      if (!worktree) {
        logErro(
          `worktree do card ${id}`,
          `workspace "${project.workspace}" não é um repositório git; o agente vai rodar direto no workspace, sem isolamento`
        );
      }
    }

    const cardDoBoard = board.cards.find((card) => card.id === id);
    const cardForPrompt: Pick<Card, "title" | "description" | "history" | "messages"> = {
      title: cardRow.title,
      description: cardRow.description,
      history: cardDoBoard?.history ?? [],
      messages: cardDoBoard?.messages ?? [],
    };
    const prompt = buildPrompt(col, cardForPrompt, project, worktree ?? undefined);

    const result = await runTool({
      tool,
      project,
      prompt,
      cwd: worktree?.caminho,
      onSpawn: (child) => {
        children.set(id, child);
        if (cancelled.has(id)) killTree(child); // cancel arrived before spawn
      },
    });
    children.delete(id);

    // Cancelled by the user: record it, don't error, don't chain onward.
    if (consumirCancelamento(id, col.id, project.tool)) return;

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
    encerrarExecucao(id);
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

const TURNO_SEM_RESPOSTA = "⚠ O agente encerrou o turno sem escrever nada.";

// A conversa reaproveita a worktree que o card já tem — nunca cria. Card que
// chegou na revisão sem passar por Development não tem branch pra ler: o chat
// roda no workspace do projeto, degradado mas funcional.
async function worktreeParaConversa(id: string, project: Project): Promise<Worktree | null> {
  try {
    return await worktreeExistente({
      workspace: ensureWorkspaceDir(project.workspace),
      cardId: id,
    });
  } catch (erro) {
    logErro(`worktree da conversa do card ${id}`, erro);
    return null;
  }
}

// One turn of a chat column: build the transcript prompt, get the agent's reply,
// store it as an "agent" message. Shares the cancel machinery with runCard.
async function runChatTurn(id: string) {
  if (temAgenteVivo(id)) {
    logErro("turno de chat", `card ${id} já tem um agente em execução; turno descartado`);
    return;
  }
  registrarExecucao(id);

  let devolverPara: string | null = null;
  try {
    const cardRow = getCardRow(id);
    if (!cardRow) {
      logErro("turno de chat", `card não encontrado: ${id}`);
      return;
    }
    const col = getColumn(cardRow.columnId);
    if (!col) {
      logErro("turno de chat", `coluna não encontrada: ${cardRow.columnId}`);
      return;
    }
    const project = getProject(cardRow.projectId);
    const board = getBoard();
    const tool = project ? board.tools[project.tool] : undefined;

    if (!project || !tool) {
      setCardStatus(id, "error");
      addMessage(id, "agent", `⚠ Tool/project inválido para o card ${id}.`, false);
      return;
    }

    setCardStatus(id, "running");

    const worktree = col.worktree ? await worktreeParaConversa(id, project) : null;

    const cardForPrompt = {
      title: cardRow.title,
      description: cardRow.description,
      messages: board.cards.find((card) => card.id === id)?.messages ?? [],
    };
    const prompt = buildChatPrompt(col, cardForPrompt, project, worktree ?? undefined);

    const result = await runTool({
      tool,
      project,
      prompt,
      cwd: worktree?.caminho,
      onSpawn: (child) => {
        children.set(id, child);
        if (cancelled.has(id)) killTree(child);
      },
    });
    children.delete(id);

    if (consumirCancelamento(id, col.id)) return;

    const turno = col.verdict ? separarVeredito(result.output) : null;
    const respostaDoAgente = textoNaoVazio(turno ? turno.texto : result.output);
    // Turno que não escreveu nada é turno que falhou, mesmo com a CLI saindo em
    // 0: quem pediu continua sem resposta. Sem isso o card ficaria `idle`, sem
    // oferecer o "rodar de novo", e o placeholder entraria como fala do agente no
    // prompt do turno seguinte.
    const turnoRespondido = result.ok && !!respostaDoAgente;

    setCardStatus(id, turnoRespondido ? "idle" : "error");

    // Marcador sozinho não é pedido: sem texto acima dele o dev agent receberia
    // um contexto vazio, então o card fica onde está.
    const pedidoDeMudanca =
      turnoRespondido && turno?.verdict === "CHANGES_REQUESTED" ? respostaDoAgente : null;

    // A resposta que falhou fica na thread pra quem quiser ler o que quebrou,
    // mas marcada: o turno seguinte a ignora e responde a mensagem do usuário
    // outra vez, em vez de continuar de cima de um traceback.
    if (respostaDoAgente) {
      addMessage(id, "agent", respostaDoAgente, result.ok);
    } else {
      logErro("turno de chat", `card ${id}: o agente encerrou o turno sem escrever resposta`);
      addMessage(id, "agent", TURNO_SEM_RESPOSTA, false);
    }

    // A saída inteira, marcador incluído, é o que vai pro histórico: é dela que
    // o dev agent recebe o pedido e é nela que a UI reconhece o veredito.
    if (pedidoDeMudanca && col.onReject) {
      addRun({
        cardId: id,
        column: col.id,
        tool: project.tool,
        ok: true,
        output: result.output.slice(0, 20000),
        at: nowStamp(),
      });
      addMessage(id, "agent", notaDeDevolucao(getColumn(col.onReject)?.name ?? col.onReject));
      devolverPara = col.onReject;
    }
  } finally {
    encerrarExecucao(id);
    children.delete(id);
  }

  // Depois de soltar o lock, senão o agente da coluna de destino não sobe. Sem
  // `chained` de propósito: a devolução saiu de uma decisão humana, então o
  // orçamento de ciclos de review volta cheio.
  if (devolverPara) await moveCard(id, devolverPara);
}

// Criar já numa coluna que roda agente dispara o agente na hora — é o mesmo
// desfecho de arrastar o card pra lá, e a UI avisa disso no compositor.
export function createCard(input: {
  title: string;
  description?: string;
  projectId?: string;
  columnId?: string;
}) {
  const card = storeCreateCard(input);

  const col = getColumn(card.columnId);
  if (!col) {
    logErro("criação de card", `card ${card.id} caiu em coluna inexistente: ${card.columnId}`);
    return card;
  }

  dispararNaChegada(card.id, col);
  return card;
}

export type ResultadoDeEdicao =
  | { situacao: "editado"; card: Card }
  | { situacao: "card-inexistente" }
  | { situacao: "agente-ocupado" };

// Com agente em atuação a edição é recusada em vez de cancelar a execução:
// perder uma rodada de trabalho por causa de um ajuste de título sai mais caro
// que recusar. Salvar em silêncio também não serve — o prompt já foi montado no
// spawn e a mudança não chegaria no agente em curso.
export function updateCard(
  id: string,
  fields: Partial<Pick<Card, "title" | "description">>
): ResultadoDeEdicao {
  if (agenteOcupado(id)) {
    logErro("edição de card", `card ${id} tem um agente em atuação; edição recusada`);
    return { situacao: "agente-ocupado" };
  }

  const card = storeUpdateCard(id, fields);
  if (!card) {
    logErro("edição de card", `card não encontrado: ${id}`);
    return { situacao: "card-inexistente" };
  }

  return { situacao: "editado", card };
}

// Delete a card. A running agent is killed first, so nothing writes back a
// status/run for a card that no longer exists.
export async function deleteCard(id: string): Promise<boolean> {
  await cancelCard(id, "exclusao");

  const cardRow = getCardRow(id);
  if (cardRow) await limparWorktree(id, getProject(cardRow.projectId));

  return storeDeleteCard(id);
}
