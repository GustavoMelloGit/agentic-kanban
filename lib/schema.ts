import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Projects: which tool/CLI runs, and in which workspace.
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tool: text("tool").notNull(),
  workspace: text("workspace").notNull(),
});

// Cards: the unit of work moved across columns.
export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  projectId: text("project_id").notNull(),
  columnId: text("column_id").notNull(),
  status: text("status").notNull().default("idle"),
  // dev↔review round trips already spent (see MAX_REVIEW_CYCLES)
  reviewCycles: integer("review_cycles").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// Messages: the conversation thread for a card in a chat column (Enrichment).
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardId: text("card_id").notNull(),
  role: text("role").notNull(), // 'user' | 'agent'
  content: text("content").notNull(),
  // desfecho do turno do agente; nulo na fala do usuário e nas linhas gravadas
  // antes desta coluna existir
  ok: integer("ok", { mode: "boolean" }),
  at: text("at").notNull(),
});

// Runs: one row per agent execution on a card (the card's history).
export const runs = sqliteTable("runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardId: text("card_id").notNull(),
  column: text("column").notNull(),
  tool: text("tool"),
  ok: integer("ok", { mode: "boolean" }),
  output: text("output").notNull(),
  at: text("at").notNull(),
});
