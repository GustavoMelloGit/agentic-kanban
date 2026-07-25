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
      at TEXT NOT NULL
    );
  `);

  // Tiny migrations for databases created by an older schema.
  const cardCols = (sqlite.prepare("PRAGMA table_info(cards)").all() as { name: string }[]).map(
    (c) => c.name
  );
  if (!cardCols.includes("review_cycles")) {
    sqlite.exec("ALTER TABLE cards ADD COLUMN review_cycles INTEGER NOT NULL DEFAULT 0");
  }

  const db = drizzle(sqlite, { schema });

  // Seed once, if empty.
  const count = sqlite.prepare("SELECT COUNT(*) AS n FROM projects").get() as { n: number };
  if (count.n === 0) {
    const insProject = sqlite.prepare(
      "INSERT INTO projects (id, name, tool, workspace) VALUES (?, ?, ?, ?)"
    );
    for (const p of SEED_PROJECTS) insProject.run(p.id, p.name, p.tool, p.workspace);

    const insCard = sqlite.prepare(
      "INSERT INTO cards (id, title, description, project_id, column_id, status, review_cycles, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const c of SEED_CARDS)
      insCard.run(
        c.id,
        c.title,
        c.description,
        c.projectId,
        c.columnId,
        c.status,
        c.reviewCycles,
        c.createdAt
      );
  }

  return db;
}

export const db: ReturnType<typeof drizzle> = g.__db ?? (g.__db = init());
