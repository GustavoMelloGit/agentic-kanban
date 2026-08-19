import { eq, asc, and, isNull } from "drizzle-orm";
import { db } from "./db";
import { cards, projects, runs, messages, attachments } from "./schema";
import { emitChange } from "./bus";
import { temAgenteVivo } from "./execucoes";
import { gerarSlugUnico } from "./slug";
import { caminhoDoAnexo, removerArquivoDoAnexo, type AnexoSalvo } from "./anexos-disco";
import {
  TOOLS,
  COLUMNS,
  type Attachment,
  type Board,
  type Card,
  type CardStatus,
  type ChatMessage,
  type Column,
  type Project,
  type RunEntry,
} from "./config";

// Execução que morreu com o processo (restart, queda) deixa o card "running" no
// banco pra sempre, sem ninguém pra terminá-la. O card está parado numa falha, e
// é como falha que ele precisa aparecer — senão o board oferece "cancelar" uma
// execução que já morreu no lugar de "rodar de novo".
function statusVisivel(id: string, status: CardStatus): CardStatus {
  if (status !== "running" || temAgenteVivo(id)) return status;
  return "error";
}

// O caminho em disco é derivado, não guardado: mover a pasta data/ do app não
// deixa o banco apontando pra arquivo que não existe mais.
function montarAnexo(anexo: AttachmentRow): Attachment {
  return {
    id: anexo.id,
    name: anexo.name,
    size: anexo.size,
    mime: anexo.mime,
    path: caminhoDoAnexo(anexo.cardId, anexo.file),
    at: anexo.at,
  };
}

function montarCard(
  card: CardRow,
  runRows: RunRow[],
  msgRows: MessageRow[],
  anexoRows: AttachmentRow[]
): Card {
  const anexosDoCard = anexoRows.filter((anexo) => anexo.cardId === card.id);

  return {
    id: card.id,
    title: card.title,
    description: card.description,
    projectId: card.projectId,
    columnId: card.columnId,
    status: statusVisivel(card.id, card.status as CardStatus),
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
        id: mensagem.id,
        role: mensagem.role as ChatMessage["role"],
        content: mensagem.content,
        ok: mensagem.ok ?? undefined,
        attachments: anexosDoCard
          .filter((anexo) => anexo.messageId === mensagem.id)
          .map(montarAnexo),
        at: mensagem.at,
      })),
    attachments: anexosDoCard.filter((anexo) => anexo.messageId === null).map(montarAnexo),
  };
}

// Assemble the full board snapshot the UI/SSE consume.
export function getBoard(): Board {
  const projectRows = db.select().from(projects).all() as Project[];
  const cardRows = db.select().from(cards).all();
  const runRows = db.select().from(runs).orderBy(asc(runs.id)).all();
  const msgRows = db.select().from(messages).orderBy(asc(messages.id)).all();
  const anexoRows = db.select().from(attachments).orderBy(asc(attachments.at)).all();

  const cardsOut = cardRows.map((card) => montarCard(card, runRows, msgRows, anexoRows));

  return { tools: TOOLS, columns: COLUMNS, projects: projectRows, cards: cardsOut };
}

export function getColumn(id: string): Column | undefined {
  return COLUMNS.find((coluna) => coluna.id === id);
}

export type CardRow = typeof cards.$inferSelect;
type RunRow = typeof runs.$inferSelect;
type MessageRow = typeof messages.$inferSelect;
type AttachmentRow = typeof attachments.$inferSelect;

export function getCardRow(id: string) {
  return db.select().from(cards).where(eq(cards.id, id)).get();
}

export function getCard(id: string): Card | undefined {
  const row = getCardRow(id);
  if (!row) return undefined;
  return montarCard(
    row,
    db.select().from(runs).where(eq(runs.cardId, id)).orderBy(asc(runs.id)).all(),
    db.select().from(messages).where(eq(messages.cardId, id)).orderBy(asc(messages.id)).all(),
    db.select().from(attachments).where(eq(attachments.cardId, id)).orderBy(asc(attachments.at)).all()
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
  return getCard(cardId)?.messages ?? [];
}

// Mensagem e anexos entram juntos, com uma notificação só: dois emitChange
// deixariam a thread piscar a mensagem sem os arquivos antes de completá-la.
export function addMessage(
  cardId: string,
  role: ChatMessage["role"],
  content: string,
  ok?: boolean,
  anexos: AnexoSalvo[] = []
) {
  const agora = new Date().toISOString();
  const inserida = db
    .insert(messages)
    .values({ cardId, role, content, ok: ok ?? null, at: agora })
    .returning({ id: messages.id })
    .get();

  if (anexos.length > 0) {
    db.insert(attachments)
      .values(anexos.map((anexo) => linhaDeAnexo(cardId, anexo, inserida.id)))
      .run();
  }

  emitChange();
  return inserida.id;
}

function linhaDeAnexo(cardId: string, anexo: AnexoSalvo, messageId: number | null) {
  return {
    id: anexo.id,
    cardId,
    messageId,
    name: anexo.nome,
    size: anexo.tamanho,
    mime: anexo.tipo,
    file: anexo.arquivo,
    at: new Date().toISOString(),
  };
}

// Anexo do card: sem mensagem dona, entra em todo disparo daquele card.
export function addCardAttachments(cardId: string, anexos: AnexoSalvo[]): Attachment[] {
  if (anexos.length === 0) return [];

  const linhas = anexos.map((anexo) => linhaDeAnexo(cardId, anexo, null));
  db.insert(attachments).values(linhas).run();
  emitChange();
  return linhas.map(montarAnexo);
}

export function getAttachmentRow(id: string): AttachmentRow | undefined {
  return db.select().from(attachments).where(eq(attachments.id, id)).get();
}

// Só anexo do card sai: remover anexo de mensagem reescreveria a conversa, que
// é registro do que foi enviado.
export function deleteCardAttachment(id: string): boolean {
  const anexo = db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, id), isNull(attachments.messageId)))
    .get();
  if (!anexo) return false;

  db.delete(attachments).where(eq(attachments.id, id)).run();
  removerArquivoDoAnexo(anexo.cardId, anexo.file);
  emitChange();
  return true;
}

// Runs, mensagens e anexos não têm FK com cascade; a limpeza é explícita.
export function deleteCard(id: string): boolean {
  const existe = db.select().from(cards).where(eq(cards.id, id)).get();
  if (!existe) return false;
  db.delete(runs).where(eq(runs.cardId, id)).run();
  db.delete(messages).where(eq(messages.cardId, id)).run();
  db.delete(attachments).where(eq(attachments.cardId, id)).run();
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
  return { ...row, history: [], messages: [], attachments: [] };
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
