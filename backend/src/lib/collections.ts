import type { Db } from "../db.js";

export type CollectionFolderRow = {
  id: number;
  user_id: number;
  parent_folder_id: number | null;
  name: string;
  color: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  viewer_count: number;
};

export type CollectionFileRow = {
  id: number;
  user_id: number;
  folder_id: number | null;
  name: string;
  url: string | null;
  notes: string | null;
  color: string;
  kind: "file" | "image";
  preview_image_url: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export type CollectionTree = {
  folders: CollectionFolderRow[];
  files: CollectionFileRow[];
};

export async function fetchCollectionTree(
  db: Db,
  userId: number,
): Promise<CollectionTree> {
  const [folders, files] = await Promise.all([
    db.query<CollectionFolderRow>(
      `WITH RECURSIVE folder_ancestors AS (
         SELECT id AS folder_id, id AS ancestor_id, user_id
         FROM collection_folders
         WHERE user_id = $1
         UNION ALL
         SELECT fa.folder_id, f.parent_folder_id, fa.user_id
         FROM folder_ancestors fa
         JOIN collection_folders f ON f.id = fa.ancestor_id
         WHERE f.parent_folder_id IS NOT NULL
       )
       SELECT
         f.id,
         f.user_id,
         f.parent_folder_id,
         f.name,
         f.color,
         f.sort_order,
         f.created_at,
         f.updated_at,
         COALESCE(vc.viewer_count, 0)::int AS viewer_count
       FROM collection_folders f
       LEFT JOIN (
         SELECT fa.folder_id, COUNT(DISTINCT s.viewer_user_id)::int AS viewer_count
         FROM folder_ancestors fa
         JOIN collection_folder_shares s
           ON s.folder_id = fa.ancestor_id
          AND s.owner_user_id = fa.user_id
         GROUP BY fa.folder_id
       ) vc ON vc.folder_id = f.id
       WHERE f.user_id = $1
       ORDER BY f.sort_order ASC, f.id ASC`,
      [userId],
    ),
    db.query<CollectionFileRow>(
      `SELECT id, user_id, folder_id, name, url, notes, color, kind, preview_image_url, sort_order, created_at, updated_at
       FROM collection_files
       WHERE user_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [userId],
    ),
  ]);

  return { folders: folders.rows, files: files.rows };
}

async function nextFolderSortOrder(
  db: Db,
  userId: number,
  parentFolderId: number | null,
): Promise<number> {
  const { rows } = await db.query<{ max_order: number }>(
    `SELECT COALESCE(MAX(sort_order), -1) AS max_order
     FROM collection_folders
     WHERE user_id = $1 AND parent_folder_id IS NOT DISTINCT FROM $2`,
    [userId, parentFolderId],
  );
  return rows[0].max_order + 1;
}

async function nextFileSortOrder(
  db: Db,
  userId: number,
  folderId: number | null,
): Promise<number> {
  const { rows } = await db.query<{ max_order: number }>(
    `SELECT COALESCE(MAX(sort_order), -1) AS max_order
     FROM collection_files
     WHERE user_id = $1 AND folder_id IS NOT DISTINCT FROM $2`,
    [userId, folderId],
  );
  return rows[0].max_order + 1;
}

export async function createFolder(
  db: Db,
  userId: number,
  name: string,
  parentFolderId: number | null,
  color: string,
): Promise<CollectionFolderRow> {
  if (parentFolderId !== null) {
    const parent = await db.query<{ id: number }>(
      "SELECT id FROM collection_folders WHERE id = $1 AND user_id = $2",
      [parentFolderId, userId],
    );
    if (!parent.rows[0]) {
      throw Object.assign(new Error("Parent folder not found."), { status: 404 });
    }
  }

  const sortOrder = await nextFolderSortOrder(db, userId, parentFolderId);
  const { rows } = await db.query<CollectionFolderRow>(
    `INSERT INTO collection_folders (user_id, parent_folder_id, name, color, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, parent_folder_id, name, color, sort_order, created_at, updated_at`,
    [userId, parentFolderId, name, color, sortOrder],
  );
  return { ...rows[0], viewer_count: 0 };
}

export async function createFile(
  db: Db,
  userId: number,
  name: string,
  folderId: number | null,
  url: string | null,
  notes: string | null,
  color: string,
  kind: "file" | "image" = "file",
  previewImageUrl: string | null = null,
): Promise<CollectionFileRow> {
  if (folderId !== null) {
    const folder = await db.query<{ id: number }>(
      "SELECT id FROM collection_folders WHERE id = $1 AND user_id = $2",
      [folderId, userId],
    );
    if (!folder.rows[0]) {
      throw Object.assign(new Error("Folder not found."), { status: 404 });
    }
  }

  const sortOrder = await nextFileSortOrder(db, userId, folderId);
  const { rows } = await db.query<CollectionFileRow>(
    `INSERT INTO collection_files (user_id, folder_id, name, url, notes, color, kind, preview_image_url, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, user_id, folder_id, name, url, notes, color, kind, preview_image_url, sort_order, created_at, updated_at`,
    [userId, folderId, name, url, notes, color, kind, previewImageUrl, sortOrder],
  );
  return rows[0];
}

export async function updateFolder(
  db: Db,
  userId: number,
  folderId: number,
  name: string,
  color: string,
): Promise<CollectionFolderRow | null> {
  const { rows } = await db.query<Omit<CollectionFolderRow, "viewer_count">>(
    `UPDATE collection_folders
     SET name = $1, color = $2, updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING id, user_id, parent_folder_id, name, color, sort_order, created_at, updated_at`,
    [name, color, folderId, userId],
  );
  if (!rows[0]) return null;
  return { ...rows[0], viewer_count: 0 };
}

export async function updateFile(
  db: Db,
  userId: number,
  fileId: number,
  name: string,
  color: string,
  url: string | null,
  notes: string | null,
  previewImageUrl: string | null,
): Promise<CollectionFileRow | null> {
  const { rows } = await db.query<CollectionFileRow>(
    `UPDATE collection_files
     SET name = $1, color = $2, url = $3, notes = $4, preview_image_url = $5, updated_at = NOW()
     WHERE id = $6 AND user_id = $7
     RETURNING id, user_id, folder_id, name, url, notes, color, kind, preview_image_url, sort_order, created_at, updated_at`,
    [name, color, url, notes, previewImageUrl, fileId, userId],
  );
  return rows[0] ?? null;
}

export async function deleteFolder(
  db: Db,
  userId: number,
  folderId: number,
): Promise<boolean> {
  const result = await db.query(
    "DELETE FROM collection_folders WHERE id = $1 AND user_id = $2",
    [folderId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function deleteFile(
  db: Db,
  userId: number,
  fileId: number,
): Promise<boolean> {
  const result = await db.query(
    "DELETE FROM collection_files WHERE id = $1 AND user_id = $2",
    [fileId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}
