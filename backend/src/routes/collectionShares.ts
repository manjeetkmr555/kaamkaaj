import { Router } from "express";
import type { Db } from "../db.js";
import {
  validateEmailDomainStructure,
  validateEmailFormat,
  INVALID_EMAIL_MESSAGE,
} from "../lib/emailValidation.js";
import { getUserByEmail } from "../lib/workShares.js";

function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function ownedItem(
  db: Db,
  ownerUserId: number,
  kind: "folder" | "file",
  itemId: number,
): Promise<boolean> {
  const table = kind === "folder" ? "collection_folders" : "collection_files";
  const { rows } = await db.query<{ id: number }>(
    `SELECT id FROM ${table} WHERE id = $1 AND user_id = $2`,
    [itemId, ownerUserId],
  );
  return rows.length > 0;
}

export function createCollectionSharesRouter(db: Db): Router {
  const router = Router();

  router.post("/folders/:id/share", async (req, res) => {
    const folderId = parseId(req.params.id);
    const ownerUserId = parseId(req.body?.ownerUserId);
    const email =
      typeof req.body?.viewerEmail === "string"
        ? req.body.viewerEmail.trim().toLowerCase()
        : "";
    if (!folderId || !ownerUserId || !(await ownedItem(db, ownerUserId, "folder", folderId))) {
      return res.status(400).json({ message: "Invalid folder." });
    }
    if (!validateEmailFormat(email) || !validateEmailDomainStructure(email)) {
      return res.status(400).json({ message: INVALID_EMAIL_MESSAGE, field: "email" });
    }
    const viewer = await getUserByEmail(db, email);
    if (!viewer) {
      return res.status(404).json({
        message: "No account found with that email. They need to sign up first.",
        field: "email",
      });
    }
    if (viewer.id === ownerUserId) {
      return res.status(400).json({
        message: "You cannot share a folder with yourself.",
        field: "email",
      });
    }
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO collection_folder_shares (owner_user_id, viewer_user_id, folder_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (owner_user_id, viewer_user_id, folder_id) DO NOTHING
       RETURNING id`,
      [ownerUserId, viewer.id, folderId],
    );
    if (!rows[0]) return res.status(409).json({ message: "This folder is already shared with that person." });
    return res.status(201).json({ message: `Folder shared with ${viewer.email}.` });
  });

  router.get("/:kind/:id/viewers", async (req, res) => {
    const kind = req.params.kind === "folder" ? "folder" : req.params.kind === "file" ? "file" : null;
    const itemId = parseId(req.params.id);
    const ownerUserId = parseId(req.query.ownerUserId);
    if (!kind || !itemId || !ownerUserId || !(await ownedItem(db, ownerUserId, kind, itemId))) {
      return res.status(400).json({ message: "Invalid item." });
    }

    const source = kind === "folder"
      ? `WITH RECURSIVE ancestors AS (
           SELECT id, parent_folder_id FROM collection_folders WHERE id = $1
           UNION ALL
           SELECT f.id, f.parent_folder_id FROM collection_folders f
           JOIN ancestors a ON a.parent_folder_id = f.id
         )
         SELECT DISTINCT s.viewer_user_id, u.email
         FROM collection_folder_shares s
         JOIN ancestors a ON a.id = s.folder_id
         JOIN users u ON u.id = s.viewer_user_id
         WHERE s.owner_user_id = $2`
      : `WITH RECURSIVE ancestors AS (
           SELECT f.id, f.parent_folder_id
           FROM collection_files i JOIN collection_folders f ON f.id = i.folder_id
           WHERE i.id = $1
           UNION ALL
           SELECT f.id, f.parent_folder_id FROM collection_folders f
           JOIN ancestors a ON a.parent_folder_id = f.id
         )
         SELECT DISTINCT s.viewer_user_id, u.email
         FROM collection_folder_shares s
         JOIN ancestors a ON a.id = s.folder_id
         JOIN users u ON u.id = s.viewer_user_id
         WHERE s.owner_user_id = $2`;
    const { rows } = await db.query<{ viewer_user_id: number; email: string }>(source, [itemId, ownerUserId]);
    return res.json({ viewers: rows.map((row) => ({ userId: row.viewer_user_id, email: row.email })) });
  });

  router.post("/:kind/:id/share-off", async (req, res) => {
    const kind = req.params.kind === "folder" ? "folder" : req.params.kind === "file" ? "file" : null;
    const itemId = parseId(req.params.id);
    const ownerUserId = parseId(req.body?.ownerUserId);
    const viewerUserId = parseId(req.body?.viewerUserId);
    if (!kind || !itemId || !ownerUserId || !viewerUserId || !(await ownedItem(db, ownerUserId, kind, itemId))) {
      return res.status(400).json({ message: "Invalid request." });
    }
    await db.query(
      `INSERT INTO collection_share_exclusions (owner_user_id, viewer_user_id, ${kind}_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [ownerUserId, viewerUserId, itemId],
    );
    return res.json({ message: "Sharing turned off for this person." });
  });

  return router;
}
