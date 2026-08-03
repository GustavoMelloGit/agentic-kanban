import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { SEED_PROJECTS, SEED_CARDS } from "./config";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "board.db");

// Reuse a single connection across hot-reloads in dev.
const g = globalThis as unknown as { __db?: ReturnType<typeof drizzle> };

function init() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const sqlite = new Database(DB_FILE);
  sqlite.pragma("journal_mode = WAL");

  // Idempotent schema creation (kept in sync with lib/schema.ts).
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tool TEXT NOT NULL,
      workspace TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      project_id TEXT NOT NULL,
      column_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      review_cycles INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id TEXT NOT NULL,
      column TEXT NOT NULL,
      tool TEXT,
      ok INTEGER,
      output TEXT NOT NULL,
      at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      ok INTEGER,
      at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migrações de bancos criados por um schema anterior.
  const colunasDaTabela = (tabela: string) =>
    (sqlite.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[]).map(
      (coluna) => coluna.name
    );

  if (!colunasDaTabela("cards").includes("review_cycles")) {
    sqlite.exec("ALTER TABLE cards ADD COLUMN review_cycles INTEGER NOT NULL DEFAULT 0");
  }
  if (!colunasDaTabela("messages").includes("ok")) {
    sqlite.exec("ALTER TABLE messages ADD COLUMN ok INTEGER");
  }

  const db = drizzle(sqlite, { schema });

  // Seed uma vez por arquivo de banco. Sem a flag, esvaziar o board pela UI
  // faria o projeto demo (e o card dele) reaparecerem no boot seguinte.
  const jaSemeado = sqlite.prepare("SELECT value FROM meta WHERE key = 'seeded'").get();
  const totalDeProjetos = sqlite.prepare("SELECT COUNT(*) AS n FROM projects").get() as {
    n: number;
  };

  if (!jaSemeado && totalDeProjetos.n === 0) {
    const inserirProjeto = sqlite.prepare(
      "INSERT INTO projects (id, name, tool, workspace) VALUES (?, ?, ?, ?)"
    );
    for (const projeto of SEED_PROJECTS) {
      inserirProjeto.run(projeto.id, projeto.name, projeto.tool, projeto.workspace);
    }

    const inserirCard = sqlite.prepare(
      "INSERT INTO cards (id, title, description, project_id, column_id, status, review_cycles, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const card of SEED_CARDS) {
      inserirCard.run(
        card.id,
        card.title,
        card.description,
        card.projectId,
        card.columnId,
        card.status,
        card.reviewCycles,
        card.createdAt
      );
    }
  }

  if (!jaSemeado) {
    sqlite.prepare("INSERT INTO meta (key, value) VALUES ('seeded', '1')").run();
  }

  return db;
}

export const db: ReturnType<typeof drizzle> = g.__db ?? (g.__db = init());
