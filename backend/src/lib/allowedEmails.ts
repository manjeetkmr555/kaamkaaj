import type { Db } from "../db.js";

export type AllowedEmailRow = {
  id: number;
  email: string;
  created_at: Date;
};

export function normalizeAllowedEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function isEmailAllowed(db: Db, email: string): Promise<boolean> {
  const normalized = normalizeAllowedEmail(email);
  if (!normalized) return false;

  const { rows } = await db.query<{ id: number }>(
    "SELECT id FROM allowed_emails WHERE email = $1",
    [normalized],
  );

  return rows.length > 0;
}

export async function listAllowedEmails(db: Db): Promise<AllowedEmailRow[]> {
  const { rows } = await db.query<AllowedEmailRow>(
    "SELECT id, email, created_at FROM allowed_emails ORDER BY email ASC",
  );

  return rows;
}

export async function addAllowedEmail(
  db: Db,
  email: string,
): Promise<AllowedEmailRow> {
  const normalized = normalizeAllowedEmail(email);
  const { rows } = await db.query<AllowedEmailRow>(
    "INSERT INTO allowed_emails (email) VALUES ($1) RETURNING id, email, created_at",
    [normalized],
  );

  return rows[0];
}

export async function removeAllowedEmail(db: Db, id: number): Promise<boolean> {
  const result = await db.query("DELETE FROM allowed_emails WHERE id = $1", [
    id,
  ]);
  return (result.rowCount ?? 0) > 0;
}
