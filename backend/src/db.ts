import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { bootstrapAdmin } from "./lib/admin.js";

const { Pool } = pg;

export type Db = pg.Pool;

const schemaPath = path.resolve(__dirname, "../../database/schema.sql");

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is required (e.g. postgresql://kaamkaaj:kaamkaaj@localhost:5432/kaamkaaj)",
    );
  }
  return url;
}

export async function initDb(): Promise<Db> {
  const pool = new Pool({ connectionString: getDatabaseUrl() });
  const schema = fs.readFileSync(schemaPath, "utf8");
  await pool.query(schema);
  await bootstrapAdmin(pool);
  return pool;
}

export type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  is_admin: boolean;
  created_at: Date;
};
