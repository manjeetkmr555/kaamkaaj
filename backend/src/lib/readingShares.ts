import type Database from "better-sqlite3";

export function hasReadingViewAccess(
  db: Database.Database,
  ownerUserId: number,
  viewerUserId: number,
): boolean {
  if (ownerUserId === viewerUserId) return true;

  const row = db
    .prepare(
      `SELECT id FROM reading_list_shares
       WHERE owner_user_id = ? AND viewer_user_id = ?`,
    )
    .get(ownerUserId, viewerUserId) as { id: number } | undefined;

  return Boolean(row);
}
