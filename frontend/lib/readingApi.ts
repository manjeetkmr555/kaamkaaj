import { apiFetch, parseJson } from "@/lib/apiClient";

export type ReadingItem = {
  id: number;
  user_id: number;
  url: string;
  category: string;
  summary: string;
  visible_to_shared: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export async function fetchReadingItems(userId: number) {
  return parseJson<{ items: ReadingItem[] }>(
    await apiFetch(`/api/reading/items?userId=${userId}`),
  );
}

export async function addReadingItem(userId: number, url: string) {
  return parseJson<{ item: ReadingItem; aiGenerated: boolean }>(
    await apiFetch("/api/reading/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, url }),
    }),
  );
}

export async function reorderReadingItems(userId: number, orderedIds: number[]) {
  return parseJson<{ items: ReadingItem[] }>(
    await apiFetch("/api/reading/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, orderedIds }),
    }),
  );
}

export async function toggleReadingItemVisibility(userId: number, itemId: number) {
  return parseJson<{ item: ReadingItem }>(
    await apiFetch(`/api/reading/items/${itemId}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }),
  );
}

export async function deleteReadingItem(userId: number, itemId: number) {
  return parseJson<{ message: string }>(
    await apiFetch(`/api/reading/items/${itemId}?userId=${userId}`, {
      method: "DELETE",
    }),
  );
}

export type ReadingShareSent = {
  id: number;
  viewerUserId: number;
  viewerEmail: string;
  createdAt: string;
};

export type ReadingShareReceived = {
  id: number;
  ownerUserId: number;
  ownerEmail: string;
  createdAt: string;
};

export async function shareReadingList(ownerUserId: number, viewerEmail: string) {
  return parseJson<{
    message: string;
    share: { id: number; viewerEmail: string; viewerUserId: number };
  }>(
    await apiFetch("/api/reading/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerUserId, viewerEmail }),
    }),
  );
}

export async function fetchReadingSentShares(userId: number) {
  return parseJson<{ shares: ReadingShareSent[] }>(
    await apiFetch(`/api/reading/shares/sent?userId=${userId}`),
  );
}

export async function fetchReadingReceivedShares(userId: number) {
  return parseJson<{ shares: ReadingShareReceived[] }>(
    await apiFetch(`/api/reading/shares/received?userId=${userId}`),
  );
}

export async function revokeReadingShare(ownerUserId: number, shareId: number) {
  return parseJson<{ message: string }>(
    await apiFetch(`/api/reading/share/${shareId}?ownerUserId=${ownerUserId}`, {
      method: "DELETE",
    }),
  );
}

export async function fetchSharedReadingList(
  viewerUserId: number,
  ownerUserId: number,
) {
  return parseJson<{
    owner: { id: number; email: string };
    items: ReadingItem[];
    readOnly: boolean;
  }>(
    await apiFetch(
      `/api/reading/shared?ownerUserId=${ownerUserId}&viewerUserId=${viewerUserId}`,
    ),
  );
}
