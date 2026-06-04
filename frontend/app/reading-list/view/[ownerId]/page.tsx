"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ReadingBoard } from "@/components/ReadingBoard";
import { getStoredUser } from "@/lib/session";
import { fetchSharedReadingList, type ReadingItem } from "@/lib/readingApi";

export default function SharedReadingListPage() {
  const router = useRouter();
  const params = useParams();
  const ownerId = Number(params.ownerId);

  const [items, setItems] = useState<ReadingItem[]>([]);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      router.replace("/");
      return;
    }
    if (!Number.isInteger(ownerId) || ownerId < 1) {
      router.replace("/dashboard");
      return;
    }

    fetchSharedReadingList(user.id, ownerId)
      .then((data) => {
        setOwnerEmail(data.owner.email);
        setItems(data.items);
      })
      .catch((err: { message?: string }) => {
        setError(err.message ?? "Could not load shared reading list.");
      })
      .finally(() => setLoading(false));
  }, [router, ownerId]);

  if (loading) {
    return (
      <main className="app-shell flex items-center justify-center text-stone-600">
        Loading…
      </main>
    );
  }

  if (error) {
    return (
      <main className="app-shell px-6 py-10">
        <p role="alert" className="text-sm text-[var(--warning)]">
          {error}
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-teal-800 hover:underline">
          ← Back to dashboard
        </Link>
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
          <h1 className="font-serif text-2xl text-stone-900">Shared reading list</h1>
          <p className="mt-1 text-sm text-stone-600">
            Viewing <strong>{ownerEmail}</strong> — read only
          </p>
          <span className="read-only-badge">View only</span>
        </div>
        <Link href="/dashboard" className="text-sm text-teal-800 hover:underline">
          ← Dashboard
        </Link>
      </header>

      <ReadingBoard items={items} readOnly />
    </main>
  );
}
