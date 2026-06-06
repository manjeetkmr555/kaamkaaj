import type { Db } from "../db.js";

export async function isAdminUser(db: Db, userId: number): Promise<boolean> {
  const { rows } = await db.query<{ is_admin: boolean }>(
    "SELECT is_admin FROM users WHERE id = $1",
    [userId],
  );

  return Boolean(rows[0]?.is_admin);
}

export async function bootstrapAdmin(db: Db): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) return;

  await db.query("UPDATE users SET is_admin = true WHERE email = $1", [
    adminEmail,
  ]);
  await db.query(
    "INSERT INTO allowed_emails (email) VALUES ($1) ON CONFLICT (email) DO NOTHING",
    [adminEmail],
  );
}
