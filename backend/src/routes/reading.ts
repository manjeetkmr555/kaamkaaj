import { Router } from "express";
import type Database from "better-sqlite3";
import { generateReadingInsights } from "../lib/readingAi.js";
import { mapReadingItem, READING_ITEM_COLUMNS } from "../lib/readingItems.js";
import { fetchPageMeta, normalizeUrl } from "../lib/urlMeta.js";

export type ReadingItemRow = {
  id: number;
  user_id: number;
  url: string;
  category: string;
  summary: string;
  visible_to_shared: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
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

const DUPLICATE_URL_MESSAGE = "This URL is already on your reading list.";

function urlAlreadyExists(
  db: Database.Database,
  userId: number,
  normalizedUrl: string,
): boolean {
  const rows = db
    .prepare("SELECT url FROM reading_items WHERE user_id = ?")
    .all(userId) as { url: string }[];

  return rows.some((row) => normalizeUrl(row.url) === normalizedUrl);
}

function nextSortOrder(db: Database.Database, userId: number): number {
  const row = db
    .prepare(
      "SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM reading_items WHERE user_id = ?",
    )
    .get(userId) as { max_order: number };
  return row.max_order + 1;
}

export function createReadingRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/items", (req, res) => {
    const userId = parseUserId(req.query.userId);
    if (!userId || !userExists(db, userId)) {
      return res.status(400).json({ message: "Invalid user." });
    }

    const items = db
      .prepare(
        `SELECT ${READING_ITEM_COLUMNS}
         FROM reading_items
         WHERE user_id = ?
         ORDER BY sort_order ASC, id ASC`,
      )
      .all(userId) as ReadingItemRow[];

    return res.json({ items: items.map(mapReadingItem) });
  });

  router.post("/items", async (req, res) => {
    const userId = parseUserId(req.body?.userId);
    const rawUrl = typeof req.body?.url === "string" ? req.body.url : "";

    if (!userId || !userExists(db, userId)) {
      return res.status(400).json({ message: "Invalid user." });
    }

    const url = normalizeUrl(rawUrl);
    if (!url) {
      return res.status(400).json({ message: "Please enter a valid public URL." });
    }

    if (urlAlreadyExists(db, userId, url)) {
      return res.status(409).json({
        message: DUPLICATE_URL_MESSAGE,
        field: "duplicate",
      });
    }

    try {
      const meta = await fetchPageMeta(url);
      const insights = await generateReadingInsights(
        url,
        meta.title,
        meta.description,
      );

      const sortOrder = nextSortOrder(db, userId);
      const now = new Date().toISOString();

      const info = db
        .prepare(
          `INSERT INTO reading_items (user_id, url, category, summary, sort_order, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(userId, url, insights.category, insights.summary, sortOrder, now);

      const item = db
        .prepare(`SELECT ${READING_ITEM_COLUMNS} FROM reading_items WHERE id = ?`)
        .get(Number(info.lastInsertRowid)) as ReadingItemRow;

      return res.status(201).json({ item: mapReadingItem(item), aiGenerated: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not process this URL.";
      return res.status(422).json({ message });
    }
  });

  router.put("/reorder", (req, res) => {
    const userId = parseUserId(req.body?.userId);
    const orderedIds = req.body?.orderedIds;

    if (!userId || !userExists(db, userId) || !Array.isArray(orderedIds)) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const ids = orderedIds.map(Number).filter((id) => Number.isInteger(id));
    const reorder = db.transaction((itemIds: number[]) => {
      itemIds.forEach((id, index) => {
        db.prepare(
          `UPDATE reading_items SET sort_order = ?, updated_at = ?
           WHERE id = ? AND user_id = ?`,
        ).run(index, new Date().toISOString(), id, userId);
      });
    });

    reorder(ids);

    const items = db
      .prepare(
        `SELECT ${READING_ITEM_COLUMNS}
         FROM reading_items
         WHERE user_id = ?
         ORDER BY sort_order ASC, id ASC`,
      )
      .all(userId) as ReadingItemRow[];

    return res.json({ items: items.map(mapReadingItem) });
  });

  router.patch("/items/:id/visibility", (req, res) => {
    const itemId = Number(req.params.id);
    const userId = parseUserId(req.body?.userId);

    if (!userId || !userExists(db, userId) || !Number.isInteger(itemId)) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const item = db
      .prepare(`SELECT ${READING_ITEM_COLUMNS} FROM reading_items WHERE id = ? AND user_id = ?`)
      .get(itemId, userId) as ReadingItemRow | undefined;

    if (!item) {
      return res.status(404).json({ message: "Item not found." });
    }

    const nextVisible = item.visible_to_shared ? 0 : 1;
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE reading_items SET visible_to_shared = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
    ).run(nextVisible, now, itemId, userId);

    const updated = db
      .prepare(`SELECT ${READING_ITEM_COLUMNS} FROM reading_items WHERE id = ?`)
      .get(itemId) as ReadingItemRow;

    return res.json({ item: mapReadingItem(updated) });
  });

  router.delete("/items/:id", (req, res) => {
    const itemId = Number(req.params.id);
    const userId = parseUserId(req.query.userId);

    if (!userId || !userExists(db, userId) || !Number.isInteger(itemId)) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const info = db
      .prepare("DELETE FROM reading_items WHERE id = ? AND user_id = ?")
      .run(itemId, userId);

    if (info.changes === 0) {
      return res.status(404).json({ message: "Item not found." });
    }

    return res.json({ message: "Item deleted." });
  });

  return router;
}
