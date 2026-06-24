import { Router } from "express";
import type { Db } from "../db.js";
import { fetchTasksByUser } from "../lib/workTasks.js";

import type { WorkStatus, WorkTaskRow } from "../types/work.js";

export type { WorkStatus, WorkTaskRow };

const STATUSES: WorkStatus[] = ["todo", "progress", "done"];

const NEXT_STATUS: Record<WorkStatus, WorkStatus | null> = {
  todo: "progress",
  progress: "done",
  done: null,
};

function parseUserId(value: unknown): number | null {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
}

async function userExists(db: Db, userId: number): Promise<boolean> {
  const { rows } = await db.query<{ id: number }>(
    "SELECT id FROM users WHERE id = $1",
    [userId],
  );
  return rows.length > 0;
}

async function nextSortOrder(
  db: Db,
  userId: number,
  status: WorkStatus,
): Promise<number> {
  const { rows } = await db.query<{ max_order: number }>(
    "SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM work_tasks WHERE user_id = $1 AND status = $2",
    [userId, status],
  );
  return rows[0].max_order + 1;
}

export function createWorkRouter(db: Db): Router {
  const router = Router();

  router.get("/tasks", async (req, res) => {
    const userId = parseUserId(req.query.userId);
    if (!userId || !(await userExists(db, userId))) {
      return res.status(400).json({ message: "Invalid user." });
    }

    const tasks = await fetchTasksByUser(db, userId);

    return res.json({ tasks, readOnly: false });
  });

  router.post("/tasks", async (req, res) => {
    const userId = parseUserId(req.body?.userId);
    const title =
      typeof req.body?.title === "string" ? req.body.title.trim() : "";

    if (!userId || !(await userExists(db, userId))) {
      return res.status(400).json({ message: "Invalid user." });
    }
    if (!title || title.length > 500) {
      return res.status(400).json({ message: "Task title is required." });
    }
    
    // Read the status value sent by the client (e.g. "todo", "progress", "done")
    const requestedStatus = req.body?.status;

    // Check if the provided status is one of the allowed values
    const isValidStatus = STATUSES.includes(requestedStatus);

    // Use the requested status if valid, otherwise fall back to "todo"
    const status: WorkStatus = isValidStatus ? requestedStatus : "todo";

    const sortOrder = await nextSortOrder(db, userId, status);
    const { rows } = await db.query<WorkTaskRow>(
      `INSERT INTO work_tasks (user_id, title, status, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, title, status, sort_order, created_at, updated_at`,
      [userId, title, status ,sortOrder],
    );

    return res.status(201).json({ task: rows[0] });
  });

  router.put("/reorder", async (req, res) => {
    const userId = parseUserId(req.body?.userId);
    const status = req.body?.status as WorkStatus;
    const orderedIds = req.body?.orderedIds;

    if (
      !userId ||
      !(await userExists(db, userId)) ||
      !STATUSES.includes(status) ||
      !Array.isArray(orderedIds)
    ) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const ids = orderedIds.map(Number).filter((id) => Number.isInteger(id));
    const client = await db.connect();

    try {
      await client.query("BEGIN");
      for (const [index, id] of ids.entries()) {
        await client.query(
          `UPDATE work_tasks SET sort_order = $1, updated_at = $2
           WHERE id = $3 AND user_id = $4 AND status = $5`,
          [index, new Date(), id, userId, status],
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    const tasks = await fetchTasksByUser(db, userId);
    return res.json({ tasks });
  });

  router.patch("/tasks/:id/status", async (req, res) => {
    const taskId = Number(req.params.id);
    const userId = parseUserId(req.body?.userId);
    const status = req.body?.status as WorkStatus;

    if (!userId || !(await userExists(db, userId)) || !Number.isInteger(taskId)) {
      return res.status(400).json({ message: "Invalid request." });
    }
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const existing = await db.query<WorkTaskRow>(
      `SELECT id, user_id, title, status, sort_order, created_at, updated_at
       FROM work_tasks WHERE id = $1 AND user_id = $2`,
      [taskId, userId],
    );
    const task = existing.rows[0];

    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    if (task.status === status) {
      return res.json({ task });
    }

    const sortOrder = await nextSortOrder(db, userId, status);
    const now = new Date();

    const { rows } = await db.query<WorkTaskRow>(
      `UPDATE work_tasks
       SET status = $1, sort_order = $2, updated_at = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, user_id, title, status, sort_order, created_at, updated_at`,
      [status, sortOrder, now, taskId, userId],
    );

    return res.json({ task: rows[0] });
  });

  router.post("/tasks/:id/move-right", async (req, res) => {
    const taskId = Number(req.params.id);
    const userId = parseUserId(req.body?.userId);

    if (!userId || !(await userExists(db, userId)) || !Number.isInteger(taskId)) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const existing = await db.query<WorkTaskRow>(
      `SELECT id, user_id, title, status, sort_order, created_at, updated_at
       FROM work_tasks WHERE id = $1 AND user_id = $2`,
      [taskId, userId],
    );
    const task = existing.rows[0];

    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    const next = NEXT_STATUS[task.status];
    if (!next) {
      return res.status(400).json({ message: "Task is already in Done." });
    }

    const sortOrder = await nextSortOrder(db, userId, next);
    const now = new Date();

    const { rows } = await db.query<WorkTaskRow>(
      `UPDATE work_tasks
       SET status = $1, sort_order = $2, updated_at = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, user_id, title, status, sort_order, created_at, updated_at`,
      [next, sortOrder, now, taskId, userId],
    );

    return res.json({ task: rows[0] });
  });

  router.delete("/tasks/:id", async (req, res) => {
    const taskId = Number(req.params.id);
    const userId = parseUserId(req.query.userId);

    if (!userId || !(await userExists(db, userId)) || !Number.isInteger(taskId)) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const result = await db.query(
      "DELETE FROM work_tasks WHERE id = $1 AND user_id = $2",
      [taskId, userId],
    );

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: "Task not found." });
    }

    return res.json({ message: "Task deleted." });
  });

  return router;
}
