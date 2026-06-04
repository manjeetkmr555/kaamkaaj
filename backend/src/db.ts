import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dbPath =
  process.env.DATABASE_PATH ??
  path.resolve(__dirname, "../../database/kaamkaaj.db");

const schemaPath = path.resolve(__dirname, "../../database/schema.sql");

export function initDb(): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.exec(schema);

  const columns = db
    .prepare("PRAGMA table_info(reading_items)")
    .all() as { name: string }[];
  if (!columns.some((c) => c.name === "visible_to_shared")) {
    db.exec(
      "ALTER TABLE reading_items ADD COLUMN visible_to_shared INTEGER NOT NULL DEFAULT 1",
    );
  }

  return db;
}

export type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
};
