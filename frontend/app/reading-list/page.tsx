"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AddReadingModal } from "@/components/AddReadingModal";
import { ReadingBoard } from "@/components/ReadingBoard";
import { ShareReadingModal } from "@/components/ShareReadingModal";
import { getStoredUser } from "@/lib/session";
import {
  DUPLICATE_URL_MESSAGE,
  isUrlOnReadingList,
} from "@/lib/normalizeUrl";
import {
  addReadingItem,
  deleteReadingItem,
  fetchReadingItems,
  reorderReadingItems,
  toggleReadingItemVisibility,
  type ReadingItem,
} from "@/lib/readingApi";
import type { ApiError } from "@/lib/api";

export default function ReadingListPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [items, setItems] = useState<ReadingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const loadItems = useCallback(async (uid: number) => {
    const { items: list } = await fetchReadingItems(uid);
    setItems(list);
  }, []);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      router.replace("/");
      return;
    }
    setUserId(user.id);
    loadItems(user.id)
      .catch(() => setError("Could not load reading list. Is the backend running?"))
      .finally(() => setLoading(false));
  }, [router, loadItems]);

  function reorderLocal(list: ReadingItem[], fromIndex: number, toIndex: number) {
    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  }

  async function persistOrder(nextItems: ReadingItem[]) {
    if (!userId) return;
    const { items: saved } = await reorderReadingItems(
      userId,
      nextItems.map((i) => i.id),
    );
    setItems(saved);
  }

  if (loading || !userId) {
    return (
      <main className="app-shell flex items-center justify-center text-stone-600">
        Loading…
      </main>
    );
  }

  return (
    <main className="app-shell px-4 py-8 sm:px-6">
      <header className="mx-auto mb-8 flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800/70">
            KaamKaaj
          </p>
          <h1 className="font-serif text-2xl text-stone-900">Reading List</h1>
          <p className="mt-1 text-sm text-stone-600">
            Save article links with AI category and summary. Share or drag ⋮⋮ to reorder.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard" className="text-sm text-teal-800 hover:underline">
            ← Dashboard
          </Link>
          <button
            type="button"
            className="share-trigger-btn"
            onClick={() => setShareOpen(true)}
          >
            Share
          </button>
          <button
            type="button"
            className="share-trigger-btn"
            onClick={() => setAddOpen(true)}
          >
            + Add URL
          </button>
        </div>
      </header>

      {error ? (
        <p
          role="alert"
          className="mx-auto mb-4 max-w-6xl rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200"
        >
          {error}
        </p>
      ) : null}

      <ReadingBoard
        items={items}
        draggingId={draggingId}
        dropIndex={dropIndex}
        onDragStart={(id) => setDraggingId(id)}
        onDragEnd={() => {
          setDraggingId(null);
          setDropIndex(null);
        }}
        onDragOverRow={setDropIndex}
        onDropRow={async (fromIndex, toIndex) => {
          setDraggingId(null);
          setDropIndex(null);
          if (fromIndex === toIndex) return;

          const previous = items;
          const next = reorderLocal(items, fromIndex, toIndex);
          setItems(next);
          try {
            await persistOrder(next);
            setError(null);
          } catch {
            setItems(previous);
            setError("Could not reorder rows.");
          }
        }}
        onToggleVisibility={async (item) => {
          try {
            const { item: updated } = await toggleReadingItemVisibility(
              userId,
              item.id,
            );
            setItems((prev) =>
              prev.map((i) => (i.id === item.id ? updated : i)),
            );
            setError(null);
          } catch {
            setError("Could not update visibility.");
          }
        }}
        onDelete={async (item) => {
          try {
            await deleteReadingItem(userId, item.id);
            setItems((prev) => prev.filter((i) => i.id !== item.id));
            setError(null);
          } catch {
            setError("Could not delete item.");
          }
        }}
      />

      <AddReadingModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={async (url) => {
          setAdding(true);
          setError(null);

          if (isUrlOnReadingList(items, url)) {
            setError(DUPLICATE_URL_MESSAGE);
            setAddOpen(false);
            setAdding(false);
            return;
          }

          try {
            const { item } = await addReadingItem(userId, url);
            setItems((prev) => [...prev, item]);
            setError(null);
          } catch (err) {
            const apiErr = err as ApiError;
            if (apiErr.field === "duplicate") {
              setError(DUPLICATE_URL_MESSAGE);
              setAddOpen(false);
              return;
            }
            throw err;
          } finally {
            setAdding(false);
          }
        }}
      />

      {adding ? (
        <p className="mx-auto mt-4 max-w-6xl text-center text-sm text-stone-600">
          Fetching page and generating category & summary…
        </p>
      ) : null}

      <ShareReadingModal
        ownerUserId={userId}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </main>
  );
}
