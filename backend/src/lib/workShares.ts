import type Database from "better-sqlite3";

export type WorkShareRow = {
  id: number;
  owner_user_id: number;
  viewer_user_id: number;
  created_at: string;
};

export function hasViewAccess(
  db: Database.Database,
  ownerUserId: number,
  viewerUserId: number,
): boolean {
  if (ownerUserId === viewerUserId) return true;

  const row = db
    .prepare(
      `SELECT id FROM work_tracker_shares
       WHERE owner_user_id = ? AND viewer_user_id = ?`,
    )
    .get(ownerUserId, viewerUserId) as { id: number } | undefined;

  return Boolean(row);
}

export function getUserByEmail(
  db: Database.Database,
  email: string,
): { id: number; email: string } | undefined {
  return db
    .prepare("SELECT id, email FROM users WHERE email = ? COLLATE NOCASE")
    .get(email.trim().toLowerCase()) as { id: number; email: string } | undefined;
}
