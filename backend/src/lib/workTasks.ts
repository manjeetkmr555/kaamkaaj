import type { Db } from "../db.js";
import type { WorkStatus, WorkTaskRow } from "../types/work.js";

const STATUSES: WorkStatus[] = ["todo", "progress", "done"];

export async function fetchTasksByUser(
  db: Db,
  userId: number,
): Promise<Record<WorkStatus, WorkTaskRow[]>> {
  const { rows } = await db.query<WorkTaskRow>(
    `SELECT id, user_id, title, status, sort_order, created_at, updated_at
     FROM work_tasks
     WHERE user_id = $1
     ORDER BY status, sort_order ASC, id ASC`,
    [userId],
  );

  return STATUSES.reduce(
    (acc, status) => {
      acc[status] = rows.filter((r) => r.status === status);
      return acc;
    },
    {} as Record<WorkStatus, WorkTaskRow[]>,
  );
}
