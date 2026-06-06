import type { Db } from "../db.js";

export async function hasReadingViewAccess(
  db: Db,
  ownerUserId: number,
  viewerUserId: number,
): Promise<boolean> {
  if (ownerUserId === viewerUserId) return true;

  const { rows } = await db.query<{ id: number }>(
    `SELECT id FROM reading_list_shares
     WHERE owner_user_id = $1 AND viewer_user_id = $2`,
    [ownerUserId, viewerUserId],
  );

  return rows.length > 0;
}
