import { Router } from "express";
import type Database from "better-sqlite3";
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

function userExists(db: Database.Database, userId: number): boolean {
  const row = db.prepare("SELECT id FROM users WHERE id = ?").get(userId) as
    | { id: number }
    | undefined;
  return Boolean(row);
}

function nextSortOrder(
  db: Database.Database,
  userId: number,
  status: WorkStatus,
): number {
  const row = db
    .prepare(
      "SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM work_tasks WHERE user_id = ? AND status = ?",
    )
    .get(userId, status) as { max_order: number };
  return row.max_order + 1;
}

export function createWorkRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/tasks", (req, res) => {
    const userId = parseUserId(req.query.userId);
    if (!userId || !userExists(db, userId)) {
      return res.status(400).json({ message: "Invalid user." });
    }

    const tasks = fetchTasksByUser(db, userId);

    return res.json({ tasks, readOnly: false });
  });

  router.post("/tasks", (req, res) => {
    const userId = parseUserId(req.body?.userId);
    const title =
      typeof req.body?.title === "string" ? req.body.title.trim() : "";

    if (!userId || !userExists(db, userId)) {
      return res.status(400).json({ message: "Invalid user." });
    }
    if (!title || title.length > 500) {
      return res.status(400).json({ message: "Task title is required." });
    }

    const sortOrder = nextSortOrder(db, userId, "todo");
    const info = db
      .prepare(
        `INSERT INTO work_tasks (user_id, title, status, sort_order)
         VALUES (?, ?, 'todo', ?)`,
      )
      .run(userId, title, sortOrder);

    const task = db
      .prepare(
        `SELECT id, user_id, title, status, sort_order, created_at, updated_at
         FROM work_tasks WHERE id = ?`,
      )
      .get(Number(info.lastInsertRowid)) as WorkTaskRow;

    return res.status(201).json({ task });
  });

  router.patch("/tasks/:id/status", (req, res) => {
    const taskId = Number(req.params.id);
    const userId = parseUserId(req.body?.userId);
    const status = req.body?.status as WorkStatus;

    if (!userId || !userExists(db, userId) || !Number.isInteger(taskId)) {
      return res.status(400).json({ message: "Invalid request." });
    }
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const task = db
      .prepare(
        `SELECT id, user_id, title, status, sort_order, created_at, updated_at
         FROM work_tasks WHERE id = ? AND user_id = ?`,
      )
      .get(taskId, userId) as WorkTaskRow | undefined;

    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    if (task.status === status) {
      return res.json({ task });
    }

    const sortOrder = nextSortOrder(db, userId, status);
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE work_tasks
       SET status = ?, sort_order = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).run(status, sortOrder, now, taskId, userId);

    const updated = db
      .prepare(
        `SELECT id, user_id, title, status, sort_order, created_at, updated_at
         FROM work_tasks WHERE id = ?`,
      )
      .get(taskId) as WorkTaskRow;

    return res.json({ task: updated });
  });

  router.post("/tasks/:id/move-right", (req, res) => {
    const taskId = Number(req.params.id);
    const userId = parseUserId(req.body?.userId);

    if (!userId || !userExists(db, userId) || !Number.isInteger(taskId)) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const task = db
      .prepare(
        `SELECT id, user_id, title, status, sort_order, created_at, updated_at
         FROM work_tasks WHERE id = ? AND user_id = ?`,
      )
      .get(taskId, userId) as WorkTaskRow | undefined;

    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    const next = NEXT_STATUS[task.status];
    if (!next) {
      return res.status(400).json({ message: "Task is already in Done." });
    }

    const sortOrder = nextSortOrder(db, userId, next);
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE work_tasks
       SET status = ?, sort_order = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).run(next, sortOrder, now, taskId, userId);

    const updated = db
      .prepare(
        `SELECT id, user_id, title, status, sort_order, created_at, updated_at
         FROM work_tasks WHERE id = ?`,
      )
      .get(taskId) as WorkTaskRow;

    return res.json({ task: updated });
  });

  router.delete("/tasks/:id", (req, res) => {
    const taskId = Number(req.params.id);
    const userId = parseUserId(req.query.userId);

    if (!userId || !userExists(db, userId) || !Number.isInteger(taskId)) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const info = db
      .prepare("DELETE FROM work_tasks WHERE id = ? AND user_id = ?")
      .run(taskId, userId);

    if (info.changes === 0) {
      return res.status(404).json({ message: "Task not found." });
    }

    return res.json({ message: "Task deleted." });
  });

  return router;
}
