import { Router } from "express";
import type { Db } from "../db.js";
import {
  createFile,
  createFolder,
  deleteFile,
  deleteFolder,
  fetchCollectionTree,
  updateFile,
  updateFolder,
} from "../lib/collections.js";
import { resolveCollectionPreviewImage } from "../lib/collectionPreview.js";

function parseUserId(value: unknown): number | null {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
}

function parseOptionalId(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) return undefined;
  return id;
}

async function userExists(db: Db, userId: number): Promise<boolean> {
  const { rows } = await db.query<{ id: number }>(
    "SELECT id FROM users WHERE id = $1",
    [userId],
  );
  return rows.length > 0;
}

function parseCollectionColor(value: unknown): string {
  const colorRaw = typeof value === "string" ? value.trim() : "";
  const allowedColors = new Set([
    "#b91c1c",
    "#ea580c",
    "#ca8a04",
    "#15803d",
    "#1d4ed8",
    "#7c3aed",
  ]);
  return allowedColors.has(colorRaw) ? colorRaw : "#1d4ed8";
}

export function createCollectionsRouter(db: Db): Router {
  const router = Router();

  router.get("/tree", async (req, res) => {
    const userId = parseUserId(req.query.userId);
    if (!userId || !(await userExists(db, userId))) {
      return res.status(400).json({ message: "Invalid user." });
    }

    const tree = await fetchCollectionTree(db, userId);
    return res.json(tree);
  });

  router.post("/folders", async (req, res) => {
    const userId = parseUserId(req.body?.userId);
    const name =
      typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const parentFolderId = parseOptionalId(req.body?.parentFolderId);
    const color = parseCollectionColor(req.body?.color);

    if (!userId || !(await userExists(db, userId))) {
      return res.status(400).json({ message: "Invalid user." });
    }
    if (!name || name.length > 200) {
      return res.status(400).json({ message: "Folder name is required." });
    }
    if (parentFolderId === undefined) {
      return res.status(400).json({ message: "Invalid parent folder." });
    }

    try {
      const folder = await createFolder(
        db,
        userId,
        name,
        parentFolderId,
        color,
      );
      return res.status(201).json({ folder });
    } catch (err) {
      const status = (err as { status?: number }).status ?? 500;
      const message =
        err instanceof Error ? err.message : "Could not create folder.";
      return res.status(status).json({ message });
    }
  });

  router.delete("/folders/:id", async (req, res) => {
    const folderId = Number(req.params.id);
    const userId = parseUserId(req.query.userId);

    if (!userId || !(await userExists(db, userId)) || !Number.isInteger(folderId)) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const deleted = await deleteFolder(db, userId, folderId);
    if (!deleted) {
      return res.status(404).json({ message: "Folder not found." });
    }

    return res.json({ message: "Folder deleted." });
  });

  router.patch("/folders/:id", async (req, res) => {
    const folderId = Number(req.params.id);
    const userId = parseUserId(req.body?.userId);
    const name =
      typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const color = parseCollectionColor(req.body?.color);

    if (!userId || !(await userExists(db, userId)) || !Number.isInteger(folderId)) {
      return res.status(400).json({ message: "Invalid request." });
    }
    if (!name || name.length > 200) {
      return res.status(400).json({ message: "Folder name is required." });
    }

    const folder = await updateFolder(db, userId, folderId, name, color);
    if (!folder) {
      return res.status(404).json({ message: "Folder not found." });
    }

    return res.json({ folder });
  });

  router.post("/files", async (req, res) => {
    const userId = parseUserId(req.body?.userId);
    const name =
      typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const folderId = parseOptionalId(req.body?.folderId);
    const url =
      typeof req.body?.url === "string" ? req.body.url.trim() || null : null;
    const notes =
      typeof req.body?.notes === "string"
        ? req.body.notes.trim() || null
        : null;
    const color = parseCollectionColor(req.body?.color);
    const kindRaw =
      typeof req.body?.kind === "string" ? req.body.kind.trim().toLowerCase() : "file";
    const kind = kindRaw === "image" ? "image" : "file";

    if (!userId || !(await userExists(db, userId))) {
      return res.status(400).json({ message: "Invalid user." });
    }
    if (!name || name.length > 500) {
      return res.status(400).json({
        message: kind === "image" ? "Image name is required." : "File name is required.",
      });
    }
    if (folderId === undefined) {
      return res.status(400).json({ message: "Invalid folder." });
    }
    if (url && url.length > 2000) {
      return res.status(400).json({ message: "URL is too long." });
    }
    if (notes && notes.length > 5000) {
      return res.status(400).json({ message: "Notes are too long." });
    }

    try {
      const previewImageUrl =
        url || notes
          ? await resolveCollectionPreviewImage({ name, url, notes })
          : null;
      const file = await createFile(
        db,
        userId,
        name,
        folderId,
        url,
        notes,
        color,
        kind,
        previewImageUrl,
      );
      return res.status(201).json({ file });
    } catch (err) {
      const status = (err as { status?: number }).status ?? 500;
      const message =
        err instanceof Error ? err.message : "Could not create file.";
      return res.status(status).json({ message });
    }
  });

  router.delete("/files/:id", async (req, res) => {
    const fileId = Number(req.params.id);
    const userId = parseUserId(req.query.userId);

    if (!userId || !(await userExists(db, userId)) || !Number.isInteger(fileId)) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const deleted = await deleteFile(db, userId, fileId);
    if (!deleted) {
      return res.status(404).json({ message: "File not found." });
    }

    return res.json({ message: "File deleted." });
  });

  router.patch("/files/:id", async (req, res) => {
    const fileId = Number(req.params.id);
    const userId = parseUserId(req.body?.userId);
    const name =
      typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const color = parseCollectionColor(req.body?.color);
    const url =
      typeof req.body?.url === "string" ? req.body.url.trim() || null : null;
    const notes =
      typeof req.body?.notes === "string"
        ? req.body.notes.trim() || null
        : null;

    if (!userId || !(await userExists(db, userId)) || !Number.isInteger(fileId)) {
      return res.status(400).json({ message: "Invalid request." });
    }
    if (!name || name.length > 500) {
      return res.status(400).json({ message: "File name is required." });
    }
    if (url && url.length > 2000) {
      return res.status(400).json({ message: "URL is too long." });
    }
    if (notes && notes.length > 5000) {
      return res.status(400).json({ message: "Notes are too long." });
    }

    const previewImageUrl =
      url || notes
        ? await resolveCollectionPreviewImage({ name, url, notes })
        : null;
    const file = await updateFile(
      db,
      userId,
      fileId,
      name,
      color,
      url,
      notes,
      previewImageUrl,
    );
    if (!file) {
      return res.status(404).json({ message: "File not found." });
    }

    return res.json({ file });
  });

  return router;
}
