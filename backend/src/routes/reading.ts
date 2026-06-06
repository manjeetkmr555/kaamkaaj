import { Router } from "express";
import type { Db } from "../db.js";
import { generateReadingInsights } from "../lib/readingAi.js";
import { mapReadingItem, READING_ITEM_COLUMNS } from "../lib/readingItems.js";
import { fetchPageMeta, normalizeUrl } from "../lib/urlMeta.js";

export type ReadingItemRow = {
  id: number;
  user_id: number;
  url: string;
  category: string;
  summary: string;
  visible_to_shared: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
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

const DUPLICATE_URL_MESSAGE = "This URL is already on your reading list.";

async function urlAlreadyExists(
  db: Db,
  userId: number,
  normalizedUrl: string,
): Promise<boolean> {
  const { rows } = await db.query<{ url: string }>(
    "SELECT url FROM reading_items WHERE user_id = $1",
    [userId],
  );

  return rows.some((row) => normalizeUrl(row.url) === normalizedUrl);
}

async function nextSortOrder(db: Db, userId: number): Promise<number> {
  const { rows } = await db.query<{ max_order: number }>(
    "SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM reading_items WHERE user_id = $1",
    [userId],
  );
  return rows[0].max_order + 1;
}

export function createReadingRouter(db: Db): Router {
  const router = Router();

  router.get("/items", async (req, res) => {
    const userId = parseUserId(req.query.userId);
    if (!userId || !(await userExists(db, userId))) {
      return res.status(400).json({ message: "Invalid user." });
    }

    const { rows } = await db.query<ReadingItemRow>(
      `SELECT ${READING_ITEM_COLUMNS}
       FROM reading_items
       WHERE user_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [userId],
    );

    return res.json({ items: rows.map(mapReadingItem) });
  });

  router.post("/items", async (req, res) => {
    const userId = parseUserId(req.body?.userId);
    const rawUrl = typeof req.body?.url === "string" ? req.body.url : "";

    if (!userId || !(await userExists(db, userId))) {
      return res.status(400).json({ message: "Invalid user." });
    }

    const url = normalizeUrl(rawUrl);
    if (!url) {
      return res.status(400).json({ message: "Please enter a valid public URL." });
    }

    if (await urlAlreadyExists(db, userId, url)) {
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

      const sortOrder = await nextSortOrder(db, userId);
      const now = new Date();

      const { rows } = await db.query<ReadingItemRow>(
        `INSERT INTO reading_items (user_id, url, category, summary, sort_order, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${READING_ITEM_COLUMNS}`,
        [userId, url, insights.category, insights.summary, sortOrder, now],
      );

      return res.status(201).json({
        item: mapReadingItem(rows[0]),
        aiGenerated: true,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not process this URL.";
      return res.status(422).json({ message });
    }
  });

  router.put("/reorder", async (req, res) => {
    const userId = parseUserId(req.body?.userId);
    const orderedIds = req.body?.orderedIds;

    if (!userId || !(await userExists(db, userId)) || !Array.isArray(orderedIds)) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const ids = orderedIds.map(Number).filter((id) => Number.isInteger(id));
    const client = await db.connect();

    try {
      await client.query("BEGIN");
      for (const [index, id] of ids.entries()) {
        await client.query(
          `UPDATE reading_items SET sort_order = $1, updated_at = $2
           WHERE id = $3 AND user_id = $4`,
          [index, new Date(), id, userId],
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    const { rows } = await db.query<ReadingItemRow>(
      `SELECT ${READING_ITEM_COLUMNS}
       FROM reading_items
       WHERE user_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [userId],
    );

    return res.json({ items: rows.map(mapReadingItem) });
  });

  router.patch("/items/:id/visibility", async (req, res) => {
    const itemId = Number(req.params.id);
    const userId = parseUserId(req.body?.userId);

    if (!userId || !(await userExists(db, userId)) || !Number.isInteger(itemId)) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const existing = await db.query<ReadingItemRow>(
      `SELECT ${READING_ITEM_COLUMNS} FROM reading_items WHERE id = $1 AND user_id = $2`,
      [itemId, userId],
    );
    const item = existing.rows[0];

    if (!item) {
      return res.status(404).json({ message: "Item not found." });
    }

    const nextVisible = !item.visible_to_shared;
    const now = new Date();

    const { rows } = await db.query<ReadingItemRow>(
      `UPDATE reading_items SET visible_to_shared = $1, updated_at = $2
       WHERE id = $3 AND user_id = $4
       RETURNING ${READING_ITEM_COLUMNS}`,
      [nextVisible, now, itemId, userId],
    );

    return res.json({ item: mapReadingItem(rows[0]) });
  });

  router.delete("/items/:id", async (req, res) => {
    const itemId = Number(req.params.id);
    const userId = parseUserId(req.query.userId);

    if (!userId || !(await userExists(db, userId)) || !Number.isInteger(itemId)) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const result = await db.query(
      "DELETE FROM reading_items WHERE id = $1 AND user_id = $2",
      [itemId, userId],
    );

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: "Item not found." });
    }

    return res.json({ message: "Item deleted." });
  });

  return router;
}
