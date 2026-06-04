import type Database from "better-sqlite3";
import type { WorkStatus, WorkTaskRow } from "../types/work.js";

const STATUSES: WorkStatus[] = ["todo", "progress", "done"];

export function fetchTasksByUser(
  db: Database.Database,
  userId: number,
): Record<WorkStatus, WorkTaskRow[]> {
  const rows = db
    .prepare(
      `SELECT id, user_id, title, status, sort_order, created_at, updated_at
       FROM work_tasks
       WHERE user_id = ?
       ORDER BY status, sort_order ASC, id ASC`,
    )
    .all(userId) as WorkTaskRow[];

  return STATUSES.reduce(
    (acc, status) => {
      acc[status] = rows.filter((r) => r.status === status);
      return acc;
    },
    {} as Record<WorkStatus, WorkTaskRow[]>,
  );
}
