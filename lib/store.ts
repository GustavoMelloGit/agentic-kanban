import { eq, asc } from "drizzle-orm";
import { db } from "./db";
import { cards, projects, runs, messages } from "./schema";
import { emitChange } from "./bus";
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

// Assemble the full board snapshot the UI/SSE consume.
export function getBoard(): Board {
  const projectRows = db.select().from(projects).all() as Project[];
  const cardRows = db.select().from(cards).all();
  const runRows = db.select().from(runs).orderBy(asc(runs.id)).all();
  const msgRows = db.select().from(messages).orderBy(asc(messages.id)).all();

  const cardsOut: Card[] = cardRows.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    projectId: c.projectId,
    columnId: c.columnId,
    status: c.status as CardStatus,
    reviewCycles: c.reviewCycles,
    createdAt: c.createdAt,
    history: runRows
      .filter((r) => r.cardId === c.id)
      .map<RunEntry>((r) => ({
        column: r.column,
        tool: r.tool ?? undefined,
        ok: r.ok ?? undefined,
        output: r.output,
        at: r.at,
      })),
    messages: msgRows
      .filter((m) => m.cardId === c.id)
      .map<ChatMessage>((m) => ({
        role: m.role as ChatMessage["role"],
        content: m.content,
        at: m.at,
      })),
  }));

  return { tools: TOOLS, columns: COLUMNS, projects: projectRows, cards: cardsOut };
}

export function getColumn(id: string): Column | undefined {
  return COLUMNS.find((c) => c.id === id);
}

export function getCardRow(id: string) {
  return db.select().from(cards).where(eq(cards.id, id)).get();
}

export function getProject(id: string): Project | undefined {
  return db.select().from(projects).where(eq(projects.id, id)).get() as Project | undefined;
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
    .map((m) => ({ role: m.role as ChatMessage["role"], content: m.content, at: m.at }));
}

export function addMessage(cardId: string, role: ChatMessage["role"], content: string) {
  db.insert(messages).values({ cardId, role, content, at: new Date().toISOString() }).run();
  emitChange();
}

// Remove a card and everything attached to it (runs + chat thread).
export function deleteCard(id: string): boolean {
  const existing = db.select().from(cards).where(eq(cards.id, id)).get();
  if (!existing) return false;
  db.delete(runs).where(eq(runs.cardId, id)).run();
  db.delete(messages).where(eq(messages.cardId, id)).run();
  db.delete(cards).where(eq(cards.id, id)).run();
  emitChange();
  return true;
}

export function createCard(input: { title: string; description?: string; projectId?: string }): Card {
  const firstProject = db.select().from(projects).limit(1).get() as Project | undefined;
  const id = `card-${Math.floor(performance.now())}-${Math.floor(performance.now() % 1000)}`;
  const row = {
    id,
    title: input.title,
    description: input.description ?? "",
    projectId: input.projectId ?? firstProject?.id ?? "demo",
    columnId: "ideas",
    status: "idle" as CardStatus,
    reviewCycles: 0,
    createdAt: new Date().toISOString(),
  };
  db.insert(cards).values(row).run();
  emitChange();
  return { ...row, history: [], messages: [] };
}
