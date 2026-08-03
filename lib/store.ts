import { eq, asc } from "drizzle-orm";
import { db } from "./db";
import { cards, projects, runs, messages } from "./schema";
import { emitChange } from "./bus";
import { gerarSlugUnico } from "./slug";
import {
  TOOLS,
  COLUMNS,
  type Board,
  type Card,
  type CardStatus,
  type ChatMessage,
  type Column,
  type Project,
  type RunEntry,
} from "./config";

function montarCard(
  card: CardRow,
  runRows: RunRow[],
  msgRows: MessageRow[]
): Card {
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    projectId: card.projectId,
    columnId: card.columnId,
    status: card.status as CardStatus,
    reviewCycles: card.reviewCycles,
    createdAt: card.createdAt,
    history: runRows
      .filter((run) => run.cardId === card.id)
      .map<RunEntry>((run) => ({
        column: run.column,
        tool: run.tool ?? undefined,
        ok: run.ok ?? undefined,
        output: run.output,
        at: run.at,
      })),
    messages: msgRows
      .filter((mensagem) => mensagem.cardId === card.id)
      .map<ChatMessage>((mensagem) => ({
        role: mensagem.role as ChatMessage["role"],
        content: mensagem.content,
        at: mensagem.at,
      })),
  };
}

// Assemble the full board snapshot the UI/SSE consume.
export function getBoard(): Board {
  const projectRows = db.select().from(projects).all() as Project[];
  const cardRows = db.select().from(cards).all();
  const runRows = db.select().from(runs).orderBy(asc(runs.id)).all();
  const msgRows = db.select().from(messages).orderBy(asc(messages.id)).all();

  const cardsOut = cardRows.map((card) => montarCard(card, runRows, msgRows));

  return { tools: TOOLS, columns: COLUMNS, projects: projectRows, cards: cardsOut };
}

export function getColumn(id: string): Column | undefined {
  return COLUMNS.find((coluna) => coluna.id === id);
}

export type CardRow = typeof cards.$inferSelect;
type RunRow = typeof runs.$inferSelect;
type MessageRow = typeof messages.$inferSelect;

export function getCardRow(id: string) {
  return db.select().from(cards).where(eq(cards.id, id)).get();
}

export function getCard(id: string): Card | undefined {
  const row = getCardRow(id);
  if (!row) return undefined;
  return montarCard(
    row,
    db.select().from(runs).where(eq(runs.cardId, id)).orderBy(asc(runs.id)).all(),
    db.select().from(messages).where(eq(messages.cardId, id)).orderBy(asc(messages.id)).all()
  );
}

export function getProject(id: string): Project | undefined {
  return db.select().from(projects).where(eq(projects.id, id)).get() as Project | undefined;
}

export function getProjects(): Project[] {
  return db.select().from(projects).all() as Project[];
}

export function countCardsInProject(projectId: string): number {
  return db.select().from(cards).where(eq(cards.projectId, projectId)).all().length;
}

export function createProject(input: Omit<Project, "id">): Project {
  const idsOcupados = new Set(getProjects().map((projeto) => projeto.id));
  const row: Project = { id: gerarSlugUnico(input.name, "projeto", idsOcupados), ...input };
  db.insert(projects).values(row).run();
  emitChange();
  return row;
}

export function updateProject(id: string, patch: Partial<Omit<Project, "id">>): Project | undefined {
  const existing = getProject(id);
  if (!existing) return undefined;
  db.update(projects).set(patch).where(eq(projects.id, id)).run();
  emitChange();
  return { ...existing, ...patch };
}

export function deleteProject(id: string): boolean {
  if (!getProject(id)) return false;
  db.delete(projects).where(eq(projects.id, id)).run();
  emitChange();
  return true;
}

export function setCardStatus(id: string, status: CardStatus) {
  db.update(cards).set({ status }).where(eq(cards.id, id)).run();
  emitChange();
}

export function setCardColumn(id: string, columnId: string) {
  db.update(cards).set({ columnId }).where(eq(cards.id, id)).run();
  emitChange();
}

export function setReviewCycles(id: string, reviewCycles: number) {
  db.update(cards).set({ reviewCycles }).where(eq(cards.id, id)).run();
  emitChange();
}

export function addRun(entry: RunEntry & { cardId: string }) {
  db.insert(runs)
    .values({
      cardId: entry.cardId,
      column: entry.column,
      tool: entry.tool ?? null,
      ok: entry.ok ?? null,
      output: entry.output,
      at: entry.at,
    })
    .run();
  emitChange();
}

export function getMessages(cardId: string): ChatMessage[] {
  return db
    .select()
    .from(messages)
    .where(eq(messages.cardId, cardId))
    .orderBy(asc(messages.id))
    .all()
    .map((mensagem) => ({
      role: mensagem.role as ChatMessage["role"],
      content: mensagem.content,
      at: mensagem.at,
    }));
}

export function addMessage(cardId: string, role: ChatMessage["role"], content: string) {
  db.insert(messages).values({ cardId, role, content, at: new Date().toISOString() }).run();
  emitChange();
}

// Runs e mensagens não têm FK com cascade; a limpeza é explícita.
export function deleteCard(id: string): boolean {
  const existe = db.select().from(cards).where(eq(cards.id, id)).get();
  if (!existe) return false;
  db.delete(runs).where(eq(runs.cardId, id)).run();
  db.delete(messages).where(eq(messages.cardId, id)).run();
  db.delete(cards).where(eq(cards.id, id)).run();
  emitChange();
  return true;
}

export function createCard(input: {
  title: string;
  description?: string;
  projectId?: string;
  columnId?: string;
}): Card {
  // Card sem projeto real nunca roda: é o projeto que define tool e workspace.
  const projeto = input.projectId
    ? getProject(input.projectId)
    : (db.select().from(projects).limit(1).get() as Project | undefined);
  if (!projeto) {
    throw new Error(
      input.projectId ? `projeto não encontrado: ${input.projectId}` : "nenhum projeto cadastrado"
    );
  }
  // Coluna vem do compositor da própria coluna; um id inventado deixaria o card
  // invisível no board, então recusa em vez de criar órfão.
  const colunaDestino = input.columnId ?? COLUMNS[0].id;
  if (!COLUMNS.some((coluna) => coluna.id === colunaDestino)) {
    throw new Error(`coluna não encontrada: ${colunaDestino}`);
  }

  const id = `card-${Math.floor(performance.now())}-${Math.floor(performance.now() % 1000)}`;
  const row = {
    id,
    title: input.title,
    description: input.description ?? "",
    projectId: projeto.id,
    columnId: colunaDestino,
    status: "idle" as CardStatus,
    reviewCycles: 0,
    createdAt: new Date().toISOString(),
  };
  db.insert(cards).values(row).run();
  emitChange();
  return { ...row, history: [], messages: [] };
}

export function updateCard(
  id: string,
  patch: Partial<Pick<Card, "title" | "description">>
): Card | undefined {
  if (!getCardRow(id)) return undefined;
  // `.set({})` estoura no drizzle, e um patch vazio não tem o que notificar.
  if (Object.keys(patch).length > 0) {
    db.update(cards).set(patch).where(eq(cards.id, id)).run();
    emitChange();
  }
  return getCard(id);
}
