import { Router } from "express";
import type { Db } from "../db.js";
import {
  validateEmailDomainStructure,
  validateEmailFormat,
  INVALID_EMAIL_MESSAGE,
} from "../lib/emailValidation.js";
import { hasReadingViewAccess } from "../lib/readingShares.js";
import { getUserByEmail } from "../lib/workShares.js";
import { mapReadingItem, READING_ITEM_COLUMNS } from "../lib/readingItems.js";
import type { ReadingItemRow } from "./reading.js";

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

export function createReadingSharesRouter(db: Db): Router {
  const router = Router();

  router.post("/share", async (req, res) => {
    const ownerUserId = parseUserId(req.body?.ownerUserId);
    const viewerEmail =
      typeof req.body?.viewerEmail === "string"
        ? req.body.viewerEmail.trim().toLowerCase()
        : "";

    if (!ownerUserId || !(await userExists(db, ownerUserId))) {
      return res.status(400).json({ message: "Invalid owner." });
    }

    if (!validateEmailFormat(viewerEmail) || !validateEmailDomainStructure(viewerEmail)) {
      return res.status(400).json({
        message: INVALID_EMAIL_MESSAGE,
        field: "email",
      });
    }

    const viewer = await getUserByEmail(db, viewerEmail);
    if (!viewer) {
      return res.status(404).json({
        message: "No account found with that email. They need to sign up first.",
        field: "email",
      });
    }

    if (viewer.id === ownerUserId) {
      return res.status(400).json({
        message: "You cannot share your reading list with yourself.",
        field: "email",
      });
    }

    const existing = await db.query<{ id: number }>(
      `SELECT id FROM reading_list_shares
       WHERE owner_user_id = $1 AND viewer_user_id = $2`,
      [ownerUserId, viewer.id],
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        message: "This reading list is already shared with that person.",
      });
    }

    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO reading_list_shares (owner_user_id, viewer_user_id)
       VALUES ($1, $2)
       RETURNING id`,
      [ownerUserId, viewer.id],
    );

    return res.status(201).json({
      share: {
        id: rows[0].id,
        ownerUserId,
        viewerEmail: viewer.email,
        viewerUserId: viewer.id,
      },
      message: `Reading list shared with ${viewer.email} (view only).`,
    });
  });

  router.get("/shares/sent", async (req, res) => {
    const userId = parseUserId(req.query.userId);
    if (!userId || !(await userExists(db, userId))) {
      return res.status(400).json({ message: "Invalid user." });
    }

    const { rows } = await db.query<{
      id: number;
      viewer_user_id: number;
      created_at: Date;
      viewer_email: string;
    }>(
      `SELECT s.id, s.viewer_user_id, s.created_at, u.email AS viewer_email
       FROM reading_list_shares s
       JOIN users u ON u.id = s.viewer_user_id
       WHERE s.owner_user_id = $1
       ORDER BY s.created_at DESC`,
      [userId],
    );

    return res.json({
      shares: rows.map((r) => ({
        id: r.id,
        viewerUserId: r.viewer_user_id,
        viewerEmail: r.viewer_email,
        createdAt: r.created_at,
      })),
    });
  });

  router.get("/shares/received", async (req, res) => {
    const userId = parseUserId(req.query.userId);
    if (!userId || !(await userExists(db, userId))) {
      return res.status(400).json({ message: "Invalid user." });
    }

    const { rows } = await db.query<{
      id: number;
      owner_user_id: number;
      created_at: Date;
      owner_email: string;
    }>(
      `SELECT s.id, s.owner_user_id, s.created_at, u.email AS owner_email
       FROM reading_list_shares s
       JOIN users u ON u.id = s.owner_user_id
       WHERE s.viewer_user_id = $1
       ORDER BY s.created_at DESC`,
      [userId],
    );

    return res.json({
      shares: rows.map((r) => ({
        id: r.id,
        ownerUserId: r.owner_user_id,
        ownerEmail: r.owner_email,
        createdAt: r.created_at,
      })),
    });
  });

  router.delete("/share/:id", async (req, res) => {
    const shareId = Number(req.params.id);
    const ownerUserId = parseUserId(req.query.ownerUserId);

    if (!ownerUserId || !(await userExists(db, ownerUserId)) || !Number.isInteger(shareId)) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const result = await db.query(
      `DELETE FROM reading_list_shares WHERE id = $1 AND owner_user_id = $2`,
      [shareId, ownerUserId],
    );

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: "Share not found." });
    }

    return res.json({ message: "Share removed." });
  });

  router.get("/shared", async (req, res) => {
    const ownerUserId = parseUserId(req.query.ownerUserId);
    const viewerUserId = parseUserId(req.query.viewerUserId);

    if (
      !ownerUserId ||
      !viewerUserId ||
      !(await userExists(db, ownerUserId)) ||
      !(await userExists(db, viewerUserId))
    ) {
      return res.status(400).json({ message: "Invalid request." });
    }

    if (!(await hasReadingViewAccess(db, ownerUserId, viewerUserId))) {
      return res.status(403).json({
        message: "You do not have access to this reading list.",
      });
    }

    const { rows: ownerRows } = await db.query<{ id: number; email: string }>(
      "SELECT id, email FROM users WHERE id = $1",
      [ownerUserId],
    );
    const owner = ownerRows[0];

    const isOwner = viewerUserId === ownerUserId;
    const { rows } = await db.query<ReadingItemRow>(
      `SELECT ${READING_ITEM_COLUMNS}
       FROM reading_items
       WHERE user_id = $1 ${isOwner ? "" : "AND visible_to_shared = true"}
       ORDER BY sort_order ASC, id ASC`,
      [ownerUserId],
    );

    return res.json({
      owner: { id: owner.id, email: owner.email },
      items: rows.map(mapReadingItem),
      readOnly: !isOwner,
    });
  });

  return router;
}
