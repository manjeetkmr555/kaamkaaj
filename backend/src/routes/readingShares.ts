import { Router } from "express";
import type Database from "better-sqlite3";
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

function userExists(db: Database.Database, userId: number): boolean {
  const row = db.prepare("SELECT id FROM users WHERE id = ?").get(userId) as
    | { id: number }
    | undefined;
  return Boolean(row);
}

export function createReadingSharesRouter(db: Database.Database): Router {
  const router = Router();

  router.post("/share", (req, res) => {
    const ownerUserId = parseUserId(req.body?.ownerUserId);
    const viewerEmail =
      typeof req.body?.viewerEmail === "string"
        ? req.body.viewerEmail.trim().toLowerCase()
        : "";

    if (!ownerUserId || !userExists(db, ownerUserId)) {
      return res.status(400).json({ message: "Invalid owner." });
    }

    if (!validateEmailFormat(viewerEmail) || !validateEmailDomainStructure(viewerEmail)) {
      return res.status(400).json({
        message: INVALID_EMAIL_MESSAGE,
        field: "email",
      });
    }

    const viewer = getUserByEmail(db, viewerEmail);
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

    const existing = db
      .prepare(
        `SELECT id FROM reading_list_shares
         WHERE owner_user_id = ? AND viewer_user_id = ?`,
      )
      .get(ownerUserId, viewer.id) as { id: number } | undefined;

    if (existing) {
      return res.status(409).json({
        message: "This reading list is already shared with that person.",
      });
    }

    const info = db
      .prepare(
        `INSERT INTO reading_list_shares (owner_user_id, viewer_user_id)
         VALUES (?, ?)`,
      )
      .run(ownerUserId, viewer.id);

    return res.status(201).json({
      share: {
        id: Number(info.lastInsertRowid),
        ownerUserId,
        viewerEmail: viewer.email,
        viewerUserId: viewer.id,
      },
      message: `Reading list shared with ${viewer.email} (view only).`,
    });
  });

  router.get("/shares/sent", (req, res) => {
    const userId = parseUserId(req.query.userId);
    if (!userId || !userExists(db, userId)) {
      return res.status(400).json({ message: "Invalid user." });
    }

    const rows = db
      .prepare(
        `SELECT s.id, s.viewer_user_id, s.created_at, u.email AS viewer_email
         FROM reading_list_shares s
         JOIN users u ON u.id = s.viewer_user_id
         WHERE s.owner_user_id = ?
         ORDER BY s.created_at DESC`,
      )
      .all(userId) as {
      id: number;
      viewer_user_id: number;
      created_at: string;
      viewer_email: string;
    }[];

    return res.json({
      shares: rows.map((r) => ({
        id: r.id,
        viewerUserId: r.viewer_user_id,
        viewerEmail: r.viewer_email,
        createdAt: r.created_at,
      })),
    });
  });

  router.get("/shares/received", (req, res) => {
    const userId = parseUserId(req.query.userId);
    if (!userId || !userExists(db, userId)) {
      return res.status(400).json({ message: "Invalid user." });
    }

    const rows = db
      .prepare(
        `SELECT s.id, s.owner_user_id, s.created_at, u.email AS owner_email
         FROM reading_list_shares s
         JOIN users u ON u.id = s.owner_user_id
         WHERE s.viewer_user_id = ?
         ORDER BY s.created_at DESC`,
      )
      .all(userId) as {
      id: number;
      owner_user_id: number;
      created_at: string;
      owner_email: string;
    }[];

    return res.json({
      shares: rows.map((r) => ({
        id: r.id,
        ownerUserId: r.owner_user_id,
        ownerEmail: r.owner_email,
        createdAt: r.created_at,
      })),
    });
  });

  router.delete("/share/:id", (req, res) => {
    const shareId = Number(req.params.id);
    const ownerUserId = parseUserId(req.query.ownerUserId);

    if (!ownerUserId || !userExists(db, ownerUserId) || !Number.isInteger(shareId)) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const info = db
      .prepare(
        `DELETE FROM reading_list_shares WHERE id = ? AND owner_user_id = ?`,
      )
      .run(shareId, ownerUserId);

    if (info.changes === 0) {
      return res.status(404).json({ message: "Share not found." });
    }

    return res.json({ message: "Share removed." });
  });

  router.get("/shared", (req, res) => {
    const ownerUserId = parseUserId(req.query.ownerUserId);
    const viewerUserId = parseUserId(req.query.viewerUserId);

    if (
      !ownerUserId ||
      !viewerUserId ||
      !userExists(db, ownerUserId) ||
      !userExists(db, viewerUserId)
    ) {
      return res.status(400).json({ message: "Invalid request." });
    }

    if (!hasReadingViewAccess(db, ownerUserId, viewerUserId)) {
      return res.status(403).json({
        message: "You do not have access to this reading list.",
      });
    }

    const owner = db
      .prepare("SELECT id, email FROM users WHERE id = ?")
      .get(ownerUserId) as { id: number; email: string };

    const isOwner = viewerUserId === ownerUserId;
    const items = db
      .prepare(
        `SELECT ${READING_ITEM_COLUMNS}
         FROM reading_items
         WHERE user_id = ? ${isOwner ? "" : "AND visible_to_shared = 1"}
         ORDER BY sort_order ASC, id ASC`,
      )
      .all(ownerUserId) as ReadingItemRow[];

    return res.json({
      owner: { id: owner.id, email: owner.email },
      items: items.map(mapReadingItem),
      readOnly: !isOwner,
    });
  });

  return router;
}
