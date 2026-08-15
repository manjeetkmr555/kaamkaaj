import { apiFetch, parseJson } from "@/lib/apiClient";

export const COLLECTION_FILE_COLORS = [
  { value: "#b91c1c", label: "Red" },
  { value: "#ea580c", label: "Orange" },
  { value: "#ca8a04", label: "Yellow" },
  { value: "#15803d", label: "Green" },
  { value: "#1d4ed8", label: "Blue" },
  { value: "#7c3aed", label: "Violet" },
] as const;

export type CollectionFileColor =
  (typeof COLLECTION_FILE_COLORS)[number]["value"];

export type CollectionFolder = {
  id: number;
  user_id: number;
  parent_folder_id: number | null;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  viewer_count: number;
};

export type CollectionItemKind = "file" | "image";

export type CollectionFile = {
  id: number;
  user_id: number;
  folder_id: number | null;
  name: string;
  url: string | null;
  notes: string | null;
  color: string;
  kind: CollectionItemKind;
  preview_image_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CollectionTree = {
  folders: CollectionFolder[];
  files: CollectionFile[];
};

export async function fetchCollectionTree(userId: number) {
  return parseJson<CollectionTree>(
    await apiFetch(`/api/collections/tree?userId=${userId}`),
  );
}

export async function createCollectionFolder(
  userId: number,
  name: string,
  parentFolderId: number | null = null,
  color: string = "#1d4ed8",
) {
  return parseJson<{ folder: CollectionFolder }>(
    await apiFetch("/api/collections/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name, parentFolderId, color }),
    }),
  );
}

export async function deleteCollectionFolder(userId: number, folderId: number) {
  return parseJson<{ message: string }>(
    await apiFetch(`/api/collections/folders/${folderId}?userId=${userId}`, {
      method: "DELETE",
    }),
  );
}

export async function updateCollectionFolder(
  userId: number,
  folderId: number,
  name: string,
  color: string,
) {
  return parseJson<{ folder: CollectionFolder }>(
    await apiFetch(`/api/collections/folders/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name, color }),
    }),
  );
}

export async function createCollectionFile(
  userId: number,
  name: string,
  options: {
    folderId?: number | null;
    color?: string;
    url?: string;
    notes?: string;
    kind?: CollectionItemKind;
  } = {},
) {
  return parseJson<{ file: CollectionFile }>(
    await apiFetch("/api/collections/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        name,
        folderId: options.folderId ?? null,
        color: options.color ?? "#1d4ed8",
        url: options.url ?? null,
        notes: options.notes ?? null,
        kind: options.kind ?? "file",
      }),
    }),
  );
}

export async function deleteCollectionFile(userId: number, fileId: number) {
  return parseJson<{ message: string }>(
    await apiFetch(`/api/collections/files/${fileId}?userId=${userId}`, {
      method: "DELETE",
    }),
  );
}

export async function updateCollectionFile(
  userId: number,
  fileId: number,
  name: string,
  color: string,
  options: { url?: string | null; notes?: string | null } = {},
) {
  return parseJson<{ file: CollectionFile }>(
    await apiFetch(`/api/collections/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        name,
        color,
        url: options.url ?? null,
        notes: options.notes ?? null,
      }),
    }),
  );
}

export function toCollectionColor(value: string | null | undefined): CollectionFileColor {
  const match = COLLECTION_FILE_COLORS.find((option) => option.value === value);
  return match?.value ?? "#1d4ed8";
}

export function parseCollectionLinkOrText(value: string): {
  url: string | null;
  notes: string | null;
} {
  const trimmed = value.trim();
  if (!trimmed) return { url: null, notes: null };
  if (/^(https?:\/\/|www\.)/i.test(trimmed)) {
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return { url, notes: null };
  }
  return { url: null, notes: trimmed };
}

export function collectionLinkOrTextValue(
  url: string | null | undefined,
  notes: string | null | undefined,
): string {
  return url?.trim() || notes?.trim() || "";
}

export type CollectionShareViewer = { userId: number; email: string };

export async function shareCollectionFolder(
  ownerUserId: number,
  folderId: number,
  viewerEmail: string,
) {
  return parseJson<{ message: string }>(
    await apiFetch(`/api/collections/folders/${folderId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerUserId, viewerEmail }),
    }),
  );
}

export async function fetchCollectionItemViewers(
  ownerUserId: number,
  kind: "folder" | "file",
  itemId: number,
) {
  return parseJson<{ viewers: CollectionShareViewer[] }>(
    await apiFetch(`/api/collections/${kind}/${itemId}/viewers?ownerUserId=${ownerUserId}`),
  );
}

export async function turnCollectionSharingOff(
  ownerUserId: number,
  kind: "folder" | "file",
  itemId: number,
  viewerUserId: number,
) {
  return parseJson<{ message: string }>(
    await apiFetch(`/api/collections/${kind}/${itemId}/share-off`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerUserId, viewerUserId }),
    }),
  );
}
