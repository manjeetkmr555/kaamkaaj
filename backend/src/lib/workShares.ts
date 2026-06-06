import type { Db } from "../db.js";

export async function hasViewAccess(
  db: Db,
  ownerUserId: number,
  viewerUserId: number,
): Promise<boolean> {
  if (ownerUserId === viewerUserId) return true;

  const { rows } = await db.query<{ id: number }>(
    `SELECT id FROM work_tracker_shares
     WHERE owner_user_id = $1 AND viewer_user_id = $2`,
    [ownerUserId, viewerUserId],
  );

  return rows.length > 0;
}

export async function getUserByEmail(
  db: Db,
  email: string,
): Promise<{ id: number; email: string } | undefined> {
  const normalized = email.trim().toLowerCase();
  const { rows } = await db.query<{ id: number; email: string }>(
    "SELECT id, email FROM users WHERE email = $1",
    [normalized],
  );

  return rows[0];
}
